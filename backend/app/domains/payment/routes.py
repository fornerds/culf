from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..subscription.models import SubscriptionPlan
from schemas import PaymentCreate, PaymentResponse, RefundBase, RefundResponse, CouponBase, CouponResponse, UserCouponBase, UserCouponResponse, KakaoPayRequest, KakaoPayRefundRequest, KakaoPaySubscriptionRequest,KakaoPayApproval
from services import PaymentService
from app.db.session import get_db
from kakaopay_service import KakaoPayService
from dotenv import load_dotenv
import os

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
        # 구독 플랜 정보를 데이터베이스에서 가져옴
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == payment_request.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        
        payment_url = kakao_service.initiate_payment(payment_request, db, plan)
        return {"redirect_url": payment_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/pay/success")
async def approve_payment(pg_token: str, tid: str, db: Session = Depends(get_db)):
    try:
        payment_approval = kakao_service.approve_payment(pg_token, tid, db)
        return payment_approval
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refund")
async def request_refund(refund_request: KakaoPayRefundRequest, db: Session = Depends(get_db)):
    try:
        refund = kakao_service.process_refund(refund_request, db)
        return refund
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription")
async def initiate_subscription(subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
    try:
        # 구독 플랜 정보를 데이터베이스에서 가져옴
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == subscription_request.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        sid = kakao_service.initiate_subscription(subscription_request, db, plan)
        return {"sid": sid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/subscription/pay")
async def pay_subscription(subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
    try:
        payment_result = kakao_service.pay_subscription(subscription_request, db)
        return payment_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/cancel")
async def cancel_subscription(sid: str, db: Session = Depends(get_db)):
    try:
        cancellation_response = kakao_service.cancel_subscription(sid, db)
        return cancellation_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/status")
async def subscription_status(sid: str, db: Session = Depends(get_db)):
    try:
        status_response = kakao_service.get_subscription_status(sid, db)
        return status_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))