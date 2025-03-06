from sqlalchemy import Column, Integer, DateTime, Date, ForeignKey, String, DECIMAL, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid


class Token(Base):
    __tablename__ = "tokens"

    token_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False, unique=True)
    total_tokens = Column(Integer, nullable=False, default=0)
    used_tokens = Column(Integer, nullable=False, default=0)
    tokens_expires_at = Column(Date)  # 단건결제 토큰 만료일
    last_charged_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="tokens")
    usage_history = relationship("TokenUsageHistory", back_populates="token")

class TokenUsageHistory(Base):
    __tablename__ = "token_usage_history"

    history_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('tokens.user_id'), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.conversation_id'), nullable=False)
    subscription_id = Column(Integer, ForeignKey('user_subscriptions.subscription_id'), nullable=True) # 무제한 스톤 사용 여부
    tokens_used = Column(Integer, nullable=False, default=0)
    used_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("UserSubscription", back_populates="usage_history")
    token = relationship("Token", back_populates="usage_history")
    conversation = relationship("Conversation")

class TokenPlan(Base):
    __tablename__ = "token_plans"

    token_plan_id = Column(Integer, primary_key=True, autoincrement=True)
    tokens = Column(Integer, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False, default=0)
    discounted_price = Column(DECIMAL(10, 2), nullable=False, default=0)
    discount_rate = Column(DECIMAL(5, 2), nullable=False, default=0)
    is_promotion = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    payments = relationship("Payment", back_populates="token_plan")


class TokenGrant(Base):
    __tablename__ = "token_grants"

    token_grant_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id], backref="received_grants")
    admin = relationship("User", foreign_keys=[granted_by], backref="granted_tokens")