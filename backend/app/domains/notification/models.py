from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    type = Column(String(50), nullable=False)
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")

class UserNotificationSetting(Base):
    __tablename__ = "user_notification_settings"

    setting_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    notification_type = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True)

    user = relationship("User", back_populates="notification_settings")