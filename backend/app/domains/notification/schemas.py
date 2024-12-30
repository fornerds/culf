from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from app.domains.notification.models import NotificationType

class NotificationBase(BaseModel):
    type: NotificationType
    message: str

class NotificationCreate(NotificationBase):
    user_id: UUID

class NotificationResponse(NotificationBase):
    notification_id: int
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Notification(NotificationResponse):
    pass

class NotificationList(BaseModel):
    notifications: List[Notification]
    total_count: int
    page: int
    limit: int

    class Config:
        from_attributes = True

class NotificationSettingBase(BaseModel):
    notification_type: NotificationType
    is_enabled: bool

class NotificationSettingUpdate(NotificationSettingBase):
    pass

class NotificationSetting(NotificationSettingBase):
    setting_id: int
    user_id: UUID

    class Config:
        from_attributes = True

# 관리자용 스키마
class AdminNotificationCreate(NotificationCreate):
    """관리자가 알림을 생성할 때 사용하는 스키마"""
    pass

class AdminNotificationUpdate(BaseModel):
    """관리자가 알림을 수정할 때 사용하는 스키마"""
    type: Optional[NotificationType] = None
    message: Optional[str] = None
    is_read: Optional[bool] = None

class AdminNotificationResponse(NotificationResponse):
    """관리자가 알림을 조회할 때 사용하는 스키마"""
    user_nickname: Optional[str] = None