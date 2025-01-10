from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
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