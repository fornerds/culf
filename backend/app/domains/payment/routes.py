from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.domains.user.models import User
from app.domains.user import schemas as user_schemas
from . import schemas, services
from app.db.session import get_db
from app.core.deps import get_current_active_user
from dotenv import load_dotenv
from typing import List, Optional, Union
from uuid import UUID
from datetime import datetime
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# .env 파일 로드
load_dotenv()

router = APIRouter()

# 상품 관련 엔드포인트
@router.get("/payments/products", response_model=dict)
async def get_all_products(db: Session = Depends(get_db)):
    products = services.get_all_products(db)
    return {
        "subscription_plans": [schemas.SubscriptionPlanSchema.from_orm(plan) for plan in products["subscription_plans"]],
        "token_plans": [schemas.TokenPlanSchema.from_orm(plan) for plan in products["token_plans"]]
    }

@router.get("/payments/products/{product_id}", response_model=Union[schemas.SubscriptionPlanSchema, schemas.TokenPlanSchema])
async def get_product_by_id(product_id: int, product_type: str, db: Session = Depends(get_db)):
    product = services.get_product_by_id(db, product_id, product_type)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_type == "subscription":
        return schemas.SubscriptionPlanSchema.from_orm(product)
    elif product_type == "token":
        return schemas.TokenPlanSchema.from_orm(product)

# 결제 관련 엔드포인트
@router.post("/payments", response_model=schemas.PaymentResponse)
def create_payment(payment_data: schemas.PaymentCreate, db: Session = Depends(get_db)):
    payment = services.create_payment(db, payment_data)
    return payment

# 개인 결제 내역 조회 API
@router.get("/users/me/payments", response_model=List[schemas.PaymentResponse])
async def get_me_payments(
    page: int = 1,
    limit: int = 10,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payments = services.get_me_payments(db, user_id, page, limit, year, month)
    return payments

# 결제 상세 조회 API
@router.get("/users/me/payments/{payment_id}", response_model=schemas.PaymentResponse)
async def get_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payment = services.get_payment_detail(db, payment_id, user_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/users/me/payments/{payment_id}/cancel", response_model=schemas.PaycancelResponse)
def inquiry_refund(
    payment_id: UUID,
    refund_request: schemas.PaycancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # 환불 문의 및 환불 데이터 생성
    result = services.inquiry_payment(db, payment_id, current_user.user_id, refund_request)
    if not result:
        raise HTTPException(status_code=404, detail="Payment not found.")
    
    return {
        "inquiry_id": result["inquiry"].inquiry_id,
        "refund_id": result["refund"].refund_id,
        "payment_number": str(payment_id),
        "status": "CANCELLATION_REQUESTED",
        "message": "환불 문의와 요청이 성공적으로 접수되었습니다."
    }

# 쿠폰 관련 엔드포인트
@router.post("/admin/coupons", response_model=schemas.CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(coupon_data: schemas.CouponCreate, db: Session = Depends(get_db)):
    return services.create_coupon(db, coupon_data)

@router.put("/admin/coupons/{coupon_id}", response_model=schemas.CouponResponse)
def update_coupon(coupon_id: int, coupon_data: schemas.CouponUpdate, db: Session = Depends(get_db)):
    return services.update_coupon(db, coupon_id, coupon_data)

@router.delete("/admin/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coupon(coupon_id: int, db: Session = Depends(get_db)):
    services.delete_coupon(db, coupon_id)
    return {"message": "Coupon deleted successfully"}

@router.get("/admin/coupons/{coupon_id}", response_model=schemas.CouponResponse)
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
    return services.get_coupon(db, coupon_id)

@router.post("/payments/coupons/validate", response_model=schemas.CouponValidationResponse)
def validate_coupon(
    coupon_data: schemas.CouponValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    validation_response = services.validate_coupon(db, coupon_data.coupon_code, current_user.user_id)
    return validation_response

@router.post("/pay")
async def initiate_payment(
    payment_request: schemas.KakaoPayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        logger.info(f"Received payment request: {payment_request}")
        logger.info(f"Environment: {payment_request.environment}") 
        token_plan = services.get_token_plan(db, payment_request.plan_id)
        payment_data = services.initiate_payment(
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
        payment_approval = services.approve_payment(pg_token, db)
        return payment_approval
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription")
async def initiate_subscription(
    subscription_request: schemas.KakaoPaySubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        subscription_data = services.initiate_subscription(subscription_request, db, current_user)
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
        payment_results = services.pay_subscription(db)
        return payment_results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/cancel")
async def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        cancellation_response = services.cancel_subscription(current_user.user_id, db)
        return cancellation_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/subscription/status")
async def subscription_status(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        status_response = services.get_subscription_status(current_user.user_id, db)
        return status_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

#admin 관련 엔드 포인트
@router.get("/admin/payments", response_model=List[schemas.PaymentListResponse])
def get_admin_payments(
    query: Optional[str] = Query(None, description="검색어 (결제 ID, 닉네임, 상품명, 결제 수단)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    page: int = Query(1, description="페이지 번호"),
    limit: int = Query(10, description="페이지당 항목 수"),
    sort: str = Query("payment_date:desc", description="정렬 기준 (예: payment_date:desc)"),
    db: Session = Depends(get_db)
):
    """
    검색 및 필터링된 결제 내역 조회 API
    """
    payments = services.get_admin_payments(
        db=db,
        query=query,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
        sort=sort
    )
    return payments

@router.get("/admin/payments/{payment_id}", response_model=schemas.PaymentDetailResponse)
def get_payment_detail(payment_id: UUID, db: Session = Depends(get_db)):
    """
    단일 결제 상세 조회 API
    - 결제 내역, 환불 내역, 문의 내역을 포함하여 반환
    """
    payment = services.get_payment_detail(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/admin/payments", response_model=schemas.PaymentDetailResponse)
def create_manual_payment(payment: schemas.AdminPaymentCreate, db: Session = Depends(get_db)):
    payment_data = payment.dict()
    new_payment = services.create_manual_payment(db, payment_data)
    return new_payment

@router.post("/admin/payments/{payment_id}/refund", response_model=schemas.AdminRefundResponse)
def process_refund(payment_id: UUID, refund: schemas.RefundRequest, db: Session = Depends(get_db)):
    """
    결제 환불 처리 API
    - KakaoPay를 통해 결제 취소 요청
    - 환불 내역을 데이터베이스에 기록
    """
    try:
        # KakaoPay 환불 처리
        new_refund = services.process_refund(payment_id=payment_id, refund_data=refund.dict(), db=db)
        return new_refund
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

