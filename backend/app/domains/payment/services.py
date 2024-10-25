from sqlalchemy.orm import Session
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon
from datetime import datetime

class PaymentService:
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
    def get_payments(db: Session, user_id: int, page: int = 1, limit: int = 10):
        offset = (page - 1) * limit
        return db.query(Payment).filter(Payment.user_id == user_id).offset(offset).limit(limit).all()

    @staticmethod
    def get_payment_detail(db: Session, payment_id: int):
        return db.query(Payment).filter(Payment.payment_id == payment_id).first()

    @staticmethod
    def cancel_payment(db: Session, payment_id: int, reason: str):
        payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
        if payment:
            payment.status = 'CANCELLED'
            payment.manual_payment_reason = reason
            db.commit()
            db.refresh(payment)
            return payment
        return None

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

    @staticmethod
    def create_coupon(db: Session, coupon_data: Coupon):
        db.add(coupon_data)
        db.commit()
        db.refresh(coupon_data)
        return coupon_data

    @staticmethod
    def get_coupons(db: Session, page: int = 1, limit: int = 10):
        offset = (page - 1) * limit
        return db.query(Coupon).offset(offset).limit(limit).all()

    @staticmethod
    def get_coupon_detail(db: Session, coupon_id: int):
        return db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()

    @staticmethod
    def use_coupon(db: Session, user_coupon_data: UserCoupon):
        db.add(user_coupon_data)
        db.commit()
        db.refresh(user_coupon_data)
        return user_coupon_data
