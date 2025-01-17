from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict
from datetime import date, datetime
from uuid import UUID

class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    password_confirmation: str
    nickname: str = Field(..., min_length=2, max_length=50)
    phone_number: Optional[str] = Field(
        None,
        pattern=r'^\d{10,11}$'
    )
    birthdate: date
    gender: str = Field(..., pattern='^(M|F|N)$')
    status: str = Field(..., pattern='^(ACTIVE|INACTIVE|BANNED)$')
    role: str = Field(..., pattern='^(USER|ADMIN)$')

    @validator('password_confirmation')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('비밀번호가 일치하지 않습니다.')
        return v

class AdminUserResponse(BaseModel):
    user_id: UUID
    email: str
    nickname: str
    status: str
    role: str
    created_at: datetime

    class Config:
        orm_mode = True

class UserRoleUpdate(BaseModel):
    role: str

class NotificationBase(BaseModel):
    type: str
    message: str

class NotificationCreate(BaseModel):
    type: str
    message: str
    user_ids: Optional[List[str]] = Field(default_factory=list)

    @validator('user_ids')
    def validate_user_ids(cls, v):
        if v:
            try:
                return [str(UUID(user_id)) for user_id in v]  # UUID 형식 검증
            except ValueError as e:
                raise ValueError("Invalid UUID format")
        return v

class NotificationResponse(NotificationBase):
    notification_id: int
    created_at: datetime
    users: Optional[List[Dict[str, str]]] = None
    read_count: int = 0
    total_recipients: int = 0

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total_count: int
    page: int
    limit: int

    class Config:
        from_attributes = True

class AdminNoticeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str
    start_date: date
    end_date: date
    is_public: bool = True
    is_important: bool = False
    image_url: Optional[str] = None

class AdminNoticeCreate(AdminNoticeBase):
    pass

class AdminNoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_public: Optional[bool] = None
    is_important: Optional[bool] = None
    image_url: Optional[str] = None

class AdminNoticeResponse(AdminNoticeBase):
    notice_id: int
    view_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AdminNoticeDetail(AdminNoticeResponse):
    pass

class AdminNotificationBase(BaseModel):
    type: str = Field(..., pattern="^(TOKEN_UPDATE|CONTENT_UPDATE|PAYMENT_UPDATE|SYSTEM_NOTICE)$")
    message: str = Field(..., min_length=1)
    user_id: Optional[UUID] = None

class AdminNotificationCreate(AdminNotificationBase):
    pass

class AdminNotificationResponse(AdminNotificationBase):
    notification_id: int
    user_nickname: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WelcomeTokenUpdate(BaseModel):
    welcome_tokens: int = Field(..., ge=0, description="회원가입시 지급할 스톤 수량")

class WelcomeTokenResponse(BaseModel):
    welcome_tokens: int

    class Config:
        from_attributes = True

class TokenGrantCreate(BaseModel):
    email: EmailStr
    amount: int = Field(..., ge=1, description="지급할 스톤 수량")
    reason: str = Field(..., min_length=1, max_length=255)

class TokenGrantResponse(BaseModel):
    token_grant_id: int
    user_email: str
    amount: int
    reason: str
    granted_by: UUID
    created_at: datetime
    user_email: str
    user_nickname: str
    current_balance: int

    class Config:
        from_attributes = True


class SubscriptionPlanUpdate(BaseModel):
    plan_name: str
    price: int
    discounted_price: Optional[int] = None
    tokens_included: int
    description: Optional[str] = None
    is_promotion: bool = False

class TokenPlanUpdate(BaseModel):
    tokens: int
    price: int
    discounted_price: Optional[int] = None
    discount_rate: Optional[float] = None
    is_promotion: bool = False