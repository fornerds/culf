from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from uuid import UUID

class NotificationBase(BaseModel):
    type: str
    message: str

class NotificationCreate(NotificationBase):
    user_id: UUID

class Notification(NotificationBase):
    notification_id: int
    user_id: UUID
    is_read: bool
    created_at: datetime

    class Config:
        orm_mode = True

class NotificationList(BaseModel):
    notifications: List[Notification]
    total_count: int
    page: int
    limit: int

class NotificationSettingUpdate(BaseModel):
    notification_type: str
    is_enabled: bool

class NotificationSetting(NotificationSettingUpdate):
    setting_id: int
    user_id: UUID

    class Config:
        orm_mode = True

class UserNotificationSettingBase(BaseModel):
    notification_type: str
    is_enabled: bool

class UserNotificationSettingCreate(UserNotificationSettingBase):
    pass

class UserNotificationSettingUpdate(UserNotificationSettingBase):
    pass

class UserNotificationSetting(UserNotificationSettingBase):
    setting_id: int
    user_id: UUID

    class Config:
        orm_mode = True