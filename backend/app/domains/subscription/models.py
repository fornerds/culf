from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, DateTime, Date, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    plan_id = Column(Integer, primary_key=True, autoincrement=True)
    plan_name = Column(String(100), unique=True, nullable=False)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    discounted_price = Column(Numeric(10, 2), nullable=False, default=0)
    tokens_included = Column(Integer, nullable=False, default=0)
    description = Column(Text)
    is_promotion = Column(Boolean, nullable=False, default=True)
    promotion_details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    payments = relationship("Payment", back_populates="subscription")

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    subscription_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    plan_id = Column(Integer, ForeignKey('subscription_plans.plan_id'), nullable=False)
    start_date = Column(Date, nullable=False)
    next_billing_date = Column(Date, nullable=False)
    status = Column(Enum('ACTIVE', 'CANCELLED', name='subscription_status_enum'), nullable=False, default='ACTIVE')
    subscription_number = Column(String(20), unique=True, nullable=True)
    subscriptions_method = Column(String(50), nullable=False)

    payment_caches = relationship("PaymentCache", back_populates="subscription", cascade="all, delete-orphan")
    subscription_plan = relationship("SubscriptionPlan", backref="user_subscriptions")