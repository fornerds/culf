from datetime import datetime, timedelta
from sqlalchemy import JSON, Column, Integer, String, Float, Enum, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base
import uuid

class Payment(Base):
    __tablename__ = 'payments'

    payment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("user_subscriptions.subscription_id"), nullable=True)
    token_plan_id = Column(Integer, ForeignKey('token_plans.token_plan_id'), nullable=True)
    payment_number = Column(String(50), unique=True, nullable=False)
    transaction_number = Column(String(50), unique=True, nullable=True)
    tokens_purchased = Column(Integer, nullable=True)
    amount = Column(Float, nullable=False, default=0)
    payment_method = Column(String(50), nullable=False)
    used_coupon_id = Column(Integer, ForeignKey('coupons.coupon_id'), nullable=True)
    payment_date = Column(TIMESTAMP, nullable=False)
    status = Column(Enum('SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', name='payment_status_enum'), nullable=False, default='FAILED')
    manual_payment_reason = Column(String, nullable=True)

    # Relationships
    subscription = relationship("UserSubscription", back_populates="payments")
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
    status = Column(Enum('PENDING', 'APPROVED', 'REJECTED', name='refund_status_enum'), nullable=False, default='PENDING')
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
    discount_type = Column(Enum('RATE', 'AMOUNT', name='discount_type_enum'), nullable=False, default='RATE')
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

class PaymentCache(Base):
    __tablename__ = "payment_cache"

    cache_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)
    cid = Column(String(50), nullable=True)
    tid = Column(String(50), nullable=True, unique=True)
    partner_order_id = Column(String(100), nullable=True)
    partner_user_id = Column(String(100), nullable=True)
    subscription_id = Column(Integer, ForeignKey("user_subscriptions.subscription_id"), nullable=True)
    environment = Column(String(20), nullable=True)
    data = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.now)
    expires_at = Column(TIMESTAMP, nullable=False, default=datetime.now() + timedelta(hours=1))

    merchant_uid = Column(String(50), nullable=False, unique=True)
    payment_method = Column(String(50), nullable=False)
    token_plan_id = Column(Integer, ForeignKey('token_plans.token_plan_id'), nullable=True)
    subscription_plan_id = Column(Integer, ForeignKey("subscription_plans.plan_id"), nullable=True)
    coupon_id = Column(Integer, ForeignKey("coupons.coupon_id"), nullable=True)

    user = relationship("User", back_populates="payment_caches")
    subscription = relationship("UserSubscription", back_populates="payment_caches")
    subscription_plan = relationship("SubscriptionPlan", back_populates="payment_caches")