import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class NotificationType(enum.Enum):
    TOKEN_UPDATE = "TOKEN_UPDATE"           # 토큰 사용/충전 알림
    CONTENT_UPDATE = "CONTENT_UPDATE"       # 콘텐츠 업데이트 알림
    PAYMENT_UPDATE = "PAYMENT_UPDATE"       # 결제 관련 상태 업데이트 알림
    SYSTEM_NOTICE = "SYSTEM_NOTICE"         # 시스템 공지사항
class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")

class UserNotificationSetting(Base):
    __tablename__ = "user_notification_settings"

    setting_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    is_enabled = Column(Boolean, default=True)

    user = relationship("User", back_populates="notification_settings")