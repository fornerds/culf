from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.domains.subscription.models import SubscriptionPlan
from app.domains.payment.schemas import PaymentCreate, PaymentResponse, RefundBase, RefundResponse, CouponBase, CouponResponse, UserCouponBase, UserCouponResponse, KakaoPayRequest, KakaoPaySubscriptionRequest,KakaoPayApproval
from app.domains.payment.services import PaymentService
from app.domains.payment.kakaopay_service import KakaoPayService
from app.db.session import get_db
from dotenv import load_dotenv
import os

import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 결제 관련 엔드포인트
@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment_data: PaymentCreate, db: Session = Depends(get_db)):
    payment = PaymentService.create_payment(db, payment_data)
    return payment

@router.get("/users/me/payments", response_model=list[PaymentResponse])
def get_payments(page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    user_id = 1  # 실제로는 인증된 사용자 ID로 대체해야 함
    payments = PaymentService.get_payments(db, user_id, page, limit)
    return payments

@router.get("/users/me/payments/{payment_id}", response_model=PaymentResponse)
def get_payment_detail(payment_id: int, db: Session = Depends(get_db)):
    payment = PaymentService.get_payment_detail(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/users/me/payments/{payment_id}/cancel")
def cancel_payment(payment_id: int, reason: str, db: Session = Depends(get_db)):
    payment = PaymentService.cancel_payment(db, payment_id, reason)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment cancelled successfully", "payment": payment}

# 환불 관련 엔드포인트
@router.post("/refunds", response_model=RefundResponse)
def create_refund(refund_data: RefundBase, db: Session = Depends(get_db)):
    refund = PaymentService.create_refund(db, refund_data)
    return refund

@router.get("/users/me/refunds", response_model=list[RefundResponse])
def get_refunds(page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    user_id = 1  # 실제로는 인증된 사용자 ID로 대체해야 함
    refunds = PaymentService.get_refunds(db, user_id, page, limit)
    return refunds

@router.get("/refunds/{refund_id}", response_model=RefundResponse)
def get_refund_detail(refund_id: int, db: Session = Depends(get_db)):
    refund = PaymentService.get_refund_detail(db, refund_id)
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    return refund

@router.post("/refunds/{refund_id}/process")
def process_refund(refund_id: int, processed_by: int, db: Session = Depends(get_db)):
    refund = PaymentService.process_refund(db, refund_id, processed_by)
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    return {"message": "Refund processed successfully", "refund": refund}

# 쿠폰 관련 엔드포인트
@router.post("/coupons", response_model=CouponResponse)
def create_coupon(coupon_data: CouponBase, db: Session = Depends(get_db)):
    coupon = PaymentService.create_coupon(db, coupon_data)
    return coupon

# 필터 조회 형식
@router.get("/coupons", response_model=list[CouponResponse])
def get_coupons(page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    coupons = PaymentService.get_coupons(db, page, limit)
    return coupons

@router.get("/coupons/{coupon_id}", response_model=CouponResponse)
def get_coupon_detail(coupon_id: int, db: Session = Depends(get_db)):
    coupon = PaymentService.get_coupon_detail(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon

@router.post("/user-coupons", response_model=UserCouponResponse)
def use_coupon(user_coupon_data: UserCouponBase, db: Session = Depends(get_db)):
    user_coupon = PaymentService.use_coupon(db, user_coupon_data)
    return user_coupon

# .env 파일 로드
load_dotenv()

kakao_service = KakaoPayService()
    
@router.post("/pay")
async def initiate_payment(payment_request: KakaoPayRequest, db: Session = Depends(get_db)):
    try:
        token_plan = kakao_service.get_token_plan(db, payment_request.plan_id)
        payment_data = kakao_service.initiate_payment(payment_request, token_plan, db)
        return payment_data
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error initiating payment: {str(e)}")
        raise HTTPException(status_code=400, detail="결제 준비에 실패했습니다.")

@router.get("/pay/success")
async def approve_payment(pg_token: str, db: Session = Depends(get_db)):
    try:
        # 승인 요청 처리
        payment_approval = kakao_service.approve_payment(pg_token, db)

        logger.info(f"Payment approved successfully: {payment_approval}")
        return payment_approval

    except Exception as e:
        logger.error(f"Error during payment approval: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/refund/{refund_id}/{status}")
async def request_refund(tid: str, db: Session = Depends(get_db)):
    try:        
        refund = kakao_service.process_refund(tid, db)
        return refund
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription")
async def initiate_subscription(subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
    try:
        subscription_date = kakao_service.initiate_subscription(subscription_request, db)
        return subscription_date
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/subscription/pay")
async def pay_subscription(db: Session = Depends(get_db)):
    try:
        payment_results = kakao_service.pay_subscription(db)
        return payment_results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/cancel")
async def cancel_subscription(user_id: str, db: Session = Depends(get_db)):
    try:
        cancellation_response = kakao_service.cancel_subscription(user_id, db)
        return cancellation_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/status")
async def subscription_status(user_id: str, db: Session = Depends(get_db)):
    try:
        status_response = kakao_service.get_subscription_status(user_id, db)
        return status_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))