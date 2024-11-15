from fastapi import HTTPException, status
from sqlalchemy import extract
from sqlalchemy.orm import Session
from app.domains.token.models import TokenPlan
from app.domains.subscription.models import SubscriptionPlan
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon
from app.domains.payment.schemas import CouponCreate, CouponUpdate, CouponValidationRequest, CouponValidationResponse, PaycancelRequest
from datetime import datetime, date
from typing import List, Optional
from uuid import UUID
import logging

logger = logging.getLogger("app")

class PaymentService:
# 상품 조회
    @staticmethod
    def get_all_products(db: Session):
        subscription_plans = db.query(SubscriptionPlan).all()
        token_plans = db.query(TokenPlan).all()
        return {"subscription_plans": subscription_plans, "token_plans": token_plans}

    @staticmethod
    def get_product_by_id(db: Session, product_id: int, product_type: str):
        if product_type == "subscription":
            return db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == product_id).first()
        elif product_type == "token":
            return db.query(TokenPlan).filter(TokenPlan.token_plan_id == product_id).first()
        return None

    @staticmethod
    def create_payment(db: Session, payment_data: Payment):
        # 결제 처리 로직
        # 여기서 외부 API 호출을 통해 결제를 처리하고 결과를 반환할 수 있습니다.
        # 예시로 가상의 결제 처리 결과를 사용합니다.
        payment_record = Payment(
            user_id=payment_data.user_id,
            subscription_id=payment_data.subscription_id,
            token_plan_id=payment_data.token_plan_id,
            payment_number="PAY123456",  # 실제 결제 ID로 대체
            tokens_purchased=payment_data.tokens_purchased,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            payment_date=datetime.utcnow(),
            status='SUCCESS',  # 실제 결제 상태로 대체
        )
        
        db.add(payment_record)
        db.commit()
        db.refresh(payment_record)
        return payment_record

    @staticmethod
    def get_me_payments(db: Session, user_id: int, page: int = 1, limit: int = 10, year: int = None, month: int = None):
        offset = (page - 1) * limit
        query = db.query(Payment).filter(Payment.user_id == user_id)

        if year:
            query = query.filter(extract('year', Payment.payment_date) == year)
        if month:
            query = query.filter(extract('month', Payment.payment_date) == month)

        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_payment_detail(db: Session, payment_id: int):
        return db.query(Payment).filter(Payment.payment_id == payment_id).first()

    @staticmethod
    def inquiry_payment(db: Session, payment_id: int, user_id: str, refund_request: PaycancelRequest):
        # 결제 내역 조회
        payment = db.query(Payment).filter(Payment.payment_id == payment_id, Payment.user_id == user_id).first()
        
        # 이미 취소된 결제인지 확인
        if not payment or payment.status == 'CANCELLED':
            return None

        # 환불 문의 생성
        refund = Refund(
            payment_id=payment_id,
            user_id=user_id,
            amount=payment.amount,
            reason=refund_request.reason,
            status="PENDING",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        # 환불 테이블에 환불 문의 저장
        db.add(refund)
        db.commit()
        db.refresh(refund)
        
        # 결제 상태를 "CANCELLATION_REQUESTED"로 업데이트
        payment.status = "CANCELLATION_REQUESTED"
        db.commit()

        return refund

    @staticmethod
    def create_refund(db: Session, refund_data: Refund):
        db.add(refund_data)
        db.commit()
        db.refresh(refund_data)
        return refund_data

    @staticmethod
    def get_refunds(db: Session, user_id: int, page: int = 1, limit: int = 10):
        offset = (page - 1) * limit
        return db.query(Refund).filter(Refund.user_id == user_id).offset(offset).limit(limit).all()

    @staticmethod
    def get_refund_detail(db: Session, refund_id: int):
        return db.query(Refund).filter(Refund.refund_id == refund_id).first()

    @staticmethod
    def process_refund(db: Session, refund_id: int, processed_by: int):
        refund = db.query(Refund).filter(Refund.refund_id == refund_id).first()
        if refund:
            refund.status = 'APPROVED'  # 또는 'REJECTED'로 설정
            refund.processed_at = datetime.utcnow()
            refund.processed_by = processed_by
            db.commit()
            db.refresh(refund)
            return refund
        return None

# 쿠폰 사용 관련 서비스 코드
    @staticmethod
    def get_coupon_by_code(db, coupon_code):
        logger.info(f"Fetching coupon with code: {coupon_code}")
        coupon = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
        if not coupon:
            logger.warning(f"No coupon found with code: {coupon_code}")
        else:
            logger.info(f"Coupon details: {coupon}")
        return coupon
    
    @staticmethod
    def calculate_discount(coupon: Coupon, original_price: float) -> float:
        if coupon.discount_type == "RATE":
            return original_price * (coupon.discount_value / 100)
        elif coupon.discount_type == "AMOUNT":
            return coupon.discount_value
        return 0
    
    @staticmethod
    def record_coupon_usage(db: Session, user_id: str, coupon_id: int):
        user_coupon = UserCoupon(user_id=user_id, coupon_id=coupon_id, used_at=datetime.now())
        db.add(user_coupon)
        db.commit()

    @staticmethod
    def create_coupon(db: Session, coupon_data: CouponCreate):
        coupon = Coupon(**coupon_data.dict())
        db.add(coupon)
        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def update_coupon(db: Session, coupon_id: int, coupon_data: CouponUpdate):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        
        for key, value in coupon_data.dict(exclude_unset=True).items():
            setattr(coupon, key, value)

        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def delete_coupon(db: Session, coupon_id: int):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        
        db.delete(coupon)
        db.commit()

    @staticmethod
    def get_coupon(db: Session, coupon_id: int):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        return coupon

    @staticmethod
    def validate_coupon(db: Session, coupon_code: str, user_id: str):
        # 쿠폰 조회
        coupon = db.query(Coupon).filter(Coupon.coupon_code == coupon_code).first()
        if not coupon:
            return CouponValidationResponse(is_valid=False, reason="Coupon not found")

        # 유효 기간 확인 (date 타입 비교)
        today = datetime.now().date()  # 현재 날짜를 date 타입으로 변환
        if coupon.valid_from and coupon.valid_to:  # 유효 기간이 설정된 경우에만 확인
            if today < coupon.valid_from or today > coupon.valid_to:
                return CouponValidationResponse(is_valid=False, reason="Coupon is expired or not yet valid")

        # 최대 사용 횟수 확인
        if coupon.max_usage and coupon.used_count >= coupon.max_usage:
            return CouponValidationResponse(is_valid=False, reason="Coupon usage limit exceeded")

        # 사용자가 이미 쿠폰을 사용했는지 확인
        user_coupon = db.query(UserCoupon).filter(UserCoupon.user_id == user_id, UserCoupon.coupon_id == coupon.coupon_id).first()
        if user_coupon:
            return CouponValidationResponse(is_valid=False, reason="Coupon already used by the user")

        return CouponValidationResponse(is_valid=True)

# admin
    @staticmethod
    def get_payments(
        db: Session,
        page: int = 1,
        limit: int = 10,
        sort: str = "payment_date:desc",
        user_id: Optional[UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        payment_method: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Payment]:
        query = db.query(Payment)
        
        # 필터 추가
        if user_id:
            query = query.filter(Payment.user_id == user_id)
        if start_date:
            query = query.filter(Payment.payment_date >= start_date)
        if end_date:
            query = query.filter(Payment.payment_date <= end_date)
        if payment_method:
            query = query.filter(Payment.payment_method == payment_method)
        if status:
            query = query.filter(Payment.status == status)
        
        # 정렬 옵션
        if sort:
            field, direction = sort.split(":")
            if direction.lower() == "desc":
                query = query.order_by(getattr(Payment, field).desc())
            else:
                query = query.order_by(getattr(Payment, field).asc())
        
        # 페이지네이션 적용
        offset = (page - 1) * limit
        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_payment_detail(db: Session, payment_id: UUID) -> Optional[Payment]:
        return db.query(Payment).filter(Payment.payment_id == payment_id).first()

    @staticmethod
    def create_manual_payment(db: Session, payment_data: dict) -> Payment:
        # 수동 결제 처리 껍데기 코드
        payment = Payment(**payment_data)
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def process_refund(db: Session, payment_id: UUID, refund_data: dict) -> Refund:
        # 환불 처리 껍데기 코드
        refund = Refund(payment_id=payment_id, **refund_data)
        db.add(refund)
        db.commit()
        db.refresh(refund)
        return refund
