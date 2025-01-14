from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict
from datetime import date, datetime
from uuid import UUID
from typing import List
from app.domains.notification.schemas import NotificationSetting, NotificationResponse
from app.domains.notice.schemas import UserNoticeRead

class UserBase(BaseModel):
    email: EmailStr
    nickname: str = Field(..., min_length=2, max_length=50)
    phone_number: Optional[str] = Field(
        None, 
        pattern=r'^\d{10,11}$'  # Example: '1234567890' or '01234567890'
    )
    birthdate: Optional[date]
    gender: str = Field(..., pattern='^(M|F|N)$')

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    password_confirmation: str = Field(..., min_length=8)
    marketing_agreed: bool = False

    @validator('password_confirmation')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('passwords do not match')
        return v

class OAuthUserCreate(UserBase):
    marketing_agreed: bool = False

class UserCreationResponse(BaseModel):
    user_id: UUID
    message: str

class Subscription(BaseModel):
    subscription_id: int
    plan_id: int
    plan_name: str
    price: int
    next_billing_date: date
    status: str
    subscriptions_method: str

class UserInfo(BaseModel):
    user_id: UUID
    email: str
    nickname: str
    phone_number: str
    total_tokens: int
    created_at: datetime
    updated_at: datetime
    subscription: Optional[Subscription]
    notifications: Optional[List[NotificationResponse]] = []
    notification_settings: Optional[List[NotificationSetting]] = []
    notice_reads: Optional[List[UserNoticeRead]] = []

    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    nickname: Optional[str] = Field(None, min_length=2, max_length=50)
    phone_number: Optional[str] = Field(None, pattern=r'^\d{10,11}$')

class UserUpdateResponse(BaseModel):
    message: str

class UserDelete(BaseModel):
    reason: Optional[str]
    feedback: Optional[str]

class UserDeleteResponse(BaseModel):
    message: str

class PasswordCheck(BaseModel):
    current_password: str

class PasswordChange(BaseModel):
    new_password: str
    new_password_confirm: str

class PasswordChangeResponse(BaseModel):
    message: str

class TokenInfo(BaseModel):
    total_tokens: int
    used_tokens: int
    last_charged_at: Optional[datetime]

# Existing schemas

class UserInDBBase(UserBase):
    user_id: UUID
    password:str
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]
    status: str
    role: str
    is_corporate: bool

    class Config:
        orm_mode = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    password: str

class CorporateUserCreate(BaseModel):
    company_name: str
    business_number: Optional[str]
    contact_person: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]

class CorporateUserInDB(CorporateUserCreate):
    user_id: UUID

    class Config:
        orm_mode = True

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    nickname: Optional[str]
    phone: Optional[str]
    gender: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True