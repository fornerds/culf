from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from app.domains.notification.models import NotificationType

# 알림 응답 스키마
class NotificationResponse(BaseModel):
    notification_id: int
    type: NotificationType
    message: str
    created_at: datetime
    is_read: bool
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# 알림 생성 스키마
class NotificationCreate(BaseModel):
    type: NotificationType
    message: str
    user_ids: Optional[List[str]] = None  # None이면 전체 발송

# 알림 목록 스키마
class NotificationList(BaseModel):
    notifications: List[NotificationResponse]
    total_count: int
    page: int
    limit: int

    class Config:
        from_attributes = True

# 알림 설정 관련 스키마
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

class NotificationSettingList(BaseModel):
    settings: List[NotificationSetting]

    class Config:
        from_attributes = True