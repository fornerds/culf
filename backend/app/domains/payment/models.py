from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Enum, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base
import uuid

class Payment(Base):
    __tablename__ = 'payments'

    payment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey('subscription_plans.plan_id'), nullable=True)
    token_plan_id = Column(Integer, ForeignKey('token_plans.token_plan_id'), nullable=True)
    payment_number = Column(String(20), unique=True, nullable=False)
    transaction_number = Column(String(20), unique=True, nullable=True)  # 새로운 칼럼 추가
    tokens_purchased = Column(Integer, nullable=True)
    amount = Column(Float, nullable=False, default=0)
    payment_method = Column(String(50), nullable=False)
    used_coupon_id = Column(Integer, ForeignKey('coupons.coupon_id'), nullable=True)
    payment_date = Column(TIMESTAMP, nullable=False)
    status = Column(Enum('SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'), nullable=False, default='FAILED')
    manual_payment_reason = Column(String, nullable=True)

    # Relationships
    subscription = relationship("SubscriptionPlan", back_populates="payments")
    token_plan = relationship("TokenPlan", back_populates="payments")
    used_coupon = relationship("Coupon")
    user = relationship("User", back_populates="payments")
    refunds = relationship("Refund", back_populates="payment")

    def __repr__(self):
        return f"<Payment(payment_id={self.payment_id}, amount={self.amount}, status={self.status})>"

class Refund(Base):
    __tablename__ = 'refunds'

    refund_id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey('payments.payment_id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete="CASCADE"), nullable=False)
    inquiry_id = Column(Integer, ForeignKey('inquiries.inquiry_id', ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False, default=0)
    reason = Column(String, nullable=True)
    status = Column(Enum('PENDING', 'APPROVED', 'REJECTED'), nullable=False, default='PENDING')
    processed_at = Column(TIMESTAMP, nullable=True)
    processed_by = Column(Integer, ForeignKey('users.user_id'), nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.now)
    updated_at = Column(TIMESTAMP, nullable=False, default=datetime.now, onupdate=datetime.now)

    inquiry = relationship("Inquiry", back_populates="refunds", lazy="joined")
    payment = relationship("Payment", back_populates="refunds")

    def __repr__(self):
        return f"<Refund(refund_id={self.refund_id}, amount={self.amount}, status={self.status})>"

class Coupon(Base):
    __tablename__ = 'coupons'

    coupon_id = Column(Integer, primary_key=True, autoincrement=True)
    coupon_code = Column(String(20), unique=True, nullable=False)
    discount_type = Column(Enum('RATE', 'AMOUNT'), nullable=False, default='RATE')
    discount_value = Column(Float, nullable=False, default=0)
    valid_from = Column(TIMESTAMP, nullable=False)
    valid_to = Column(TIMESTAMP, nullable=False)
    max_usage = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)

    def __repr__(self):
        return f"<Coupon(coupon_id={self.coupon_id}, code={self.coupon_code}, discount_type={self.discount_type})>"

class UserCoupon(Base):
    __tablename__ = 'user_coupons'

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete="CASCADE"), nullable=False)
    coupon_id = Column(Integer, ForeignKey('coupons.coupon_id', ondelete="CASCADE"), primary_key=True)
    used_at = Column(TIMESTAMP, nullable=True)

    def __repr__(self):
        return f"<UserCoupon(user_id={self.user_id}, coupon_id={self.coupon_id})>"
