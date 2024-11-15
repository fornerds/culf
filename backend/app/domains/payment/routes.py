from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.domains.payment.services import PaymentService
from app.domains.payment.kakaopay_service import KakaoPayService
from app.domains.user import schemas as user_schemas
from app.domains.user.models import User
from app.db.session import get_db
from app.core.deps import get_current_active_user
from dotenv import load_dotenv
from app.domains.payment.schemas import (
    PaymentListResponse,
    PaymentDetailResponse,
    PaymentCreate,
    AdminPaymentCreate,
    RefundRequest,
    PaycancelResponse,
    AdminRefundResponse,
    PaymentResponse,
    PaycancelRequest,
    KakaoPayRequest,
    KakaoPaySubscriptionRequest,
    CouponValidationRequest,
    CouponValidationResponse,
    CouponCreate,
    CouponUpdate,
    CouponResponse,
    CouponValidationRequest,
    CouponValidationResponse,
    SubscriptionPlanSchema,
    TokenPlanSchema
)
from typing import List, Optional, Union
from uuid import UUID
from datetime import date
import logging


# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 상품 관련 엔드포인트
@router.get("/payments/products", response_model=dict)
async def get_all_products(db: Session = Depends(get_db)):
    products = PaymentService.get_all_products(db)
    return {
        "subscription_plans": [SubscriptionPlanSchema.from_orm(plan) for plan in products["subscription_plans"]],
        "token_plans": [TokenPlanSchema.from_orm(plan) for plan in products["token_plans"]]
    }

@router.get("/payments/products/{product_id}", response_model=Union[SubscriptionPlanSchema, TokenPlanSchema])
async def get_product_by_id(product_id: int, product_type: str, db: Session = Depends(get_db)):
    product = PaymentService.get_product_by_id(db, product_id, product_type)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_type == "subscription":
        return SubscriptionPlanSchema.from_orm(product)
    elif product_type == "token":
        return TokenPlanSchema.from_orm(product)

# 결제 관련 엔드포인트
@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment_data: PaymentCreate, db: Session = Depends(get_db)):
    payment = PaymentService.create_payment(db, payment_data)
    return payment

# 개인 결제 내역 조회 API
@router.get("/users/me/payments", response_model=List[PaymentResponse])
async def get_me_payments(
    page: int = 1,
    limit: int = 10,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payments = PaymentService.get_me_payments(db, user_id, page, limit, year, month)
    return payments

# 단일 결제 상세 조회 API
@router.get("/users/me/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payment = PaymentService.get_payment_detail(db, payment_id, user_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/users/me/payments/{payment_id}/cancel", response_model=PaycancelResponse)
def inquiry_refund(payment_id: int, refund_request: PaycancelRequest, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    # 환불 문의 요청을 위한 서비스 호출
    refund = PaymentService.inquiry_payment(db, payment_id, current_user.user_id, refund_request)
    if not refund:
        raise HTTPException(status_code=404, detail="Payment not found or already refunded.")
    return {
        "cancellation_id": refund.refund_id,
        "payment_number": refund.payment_id,
        "status": "CANCELLATION_REQUESTED",
        "message": "결제 취소 요청이 접수되었습니다. 처리 결과는 이메일로 안내드리겠습니다."
    }

# 쿠폰 관련 엔드포인트
@router.post("/admin/coupons", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(coupon_data: CouponCreate, db: Session = Depends(get_db)):
    return PaymentService.create_coupon(db, coupon_data)

@router.put("/admin/coupons/{coupon_id}", response_model=CouponResponse)
def update_coupon(coupon_id: int, coupon_data: CouponUpdate, db: Session = Depends(get_db)):
    return PaymentService.update_coupon(db, coupon_id, coupon_data)

@router.delete("/admin/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coupon(coupon_id: int, db: Session = Depends(get_db)):
    PaymentService.delete_coupon(db, coupon_id)
    return {"message": "Coupon deleted successfully"}

@router.get("/admin/coupons/{coupon_id}", response_model=CouponResponse)
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
    return PaymentService.get_coupon(db, coupon_id)

@router.post("/payments/coupons/validate", response_model=CouponValidationResponse)
def validate_coupon(
    coupon_data: CouponValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    validation_response = PaymentService.validate_coupon(db, coupon_data.coupon_code, current_user.user_id)
    return validation_response

# .env 파일 로드
load_dotenv()

kakao_service = KakaoPayService()

@router.post("/pay")
async def initiate_payment(
    payment_request: KakaoPayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        logger.info(f"Received payment request: {payment_request}")
        logger.info(f"Environment: {payment_request.environment}") 
        token_plan = kakao_service.get_token_plan(db, payment_request.plan_id)
        payment_data = kakao_service.initiate_payment(
            payment_request, 
            token_plan, 
            db, 
            current_user
        )
        return payment_data
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error initiating payment: {str(e)}")
        raise HTTPException(status_code=400, detail="결제 준비에 실패했습니다.")

@router.get("/pay/success")
async def approve_payment(
    pg_token: str,
    db: Session = Depends(get_db),
):
    try:
        payment_approval = kakao_service.approve_payment(pg_token, db)
        return payment_approval
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/refund/{refund_id}/{status}")
async def request_refund(tid: str, db: Session = Depends(get_db)):
    try:        
        refund = kakao_service.process_refund(tid, db)
        return refund
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription")
async def initiate_subscription(
    subscription_request: KakaoPaySubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        subscription_data = kakao_service.initiate_subscription(subscription_request, db, current_user)
        return subscription_data
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e.errors())) 
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/subscription/pay")
async def pay_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        payment_results = kakao_service.pay_subscription(db)
        return payment_results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/cancel")
async def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        cancellation_response = kakao_service.cancel_subscription(current_user.user_id, db)
        return cancellation_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/subscription/status")
async def subscription_status(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        status_response = kakao_service.get_subscription_status(current_user.user_id, db)
        return status_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
#admin 관련 엔드 포인트
# 결제 내역 목록 조회 (GET)
@router.get("/admin/payments", response_model=List[PaymentListResponse])
def get_payments(
    page: int = Query(1, description="페이지 번호"),
    limit: int = Query(10, description="페이지당 항목 수"),
    sort: str = Query("payment_date:desc", description="정렬 기준 (예: payment_date:desc)"),
    user_id: Optional[UUID] = Query(None, description="사용자 ID"),
    start_date: Optional[date] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    payment_method: Optional[str] = Query(None, description="결제 수단 (card, kakaopay)"),
    status: Optional[str] = Query(None, description="결제 상태 (SUCCESS, FAILED, CANCELLED, REFUNDED)"),
    db: Session = Depends(get_db)
):
    payments = PaymentService.get_payments(
        db, page, limit, sort, user_id, start_date, end_date, payment_method, status
    )
    return payments

# 결제 내역 상세 조회 (GET) /admin/payments/{payment_id}
@router.get("/admin/payments/{payment_id}", response_model=PaymentDetailResponse)
def get_payment_detail(payment_id: UUID, db: Session = Depends(get_db)):
    payment = PaymentService.get_payment_detail(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

# 수동 결제 처리 (POST) /admin/payments
@router.post("/admin/payments", response_model=PaymentDetailResponse)
def create_manual_payment(payment: AdminPaymentCreate, db: Session = Depends(get_db)):
    payment_data = payment.dict()
    new_payment = PaymentService.create_manual_payment(db, payment_data)
    return new_payment

# 환불 처리 (POST) /admin/payments/{payment_id}/refund
@router.post("/admin/payments/{payment_id}/refund", response_model=AdminRefundResponse)
def process_refund(payment_id: UUID, refund: RefundRequest, db: Session = Depends(get_db)):
    refund_data = refund.dict()
    new_refund = PaymentService.process_refund(db, payment_id, refund_data)
    return new_refund
