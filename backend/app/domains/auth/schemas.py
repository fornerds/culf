from pydantic import BaseModel, EmailStr
from typing import Optional

class EmailPasswordLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

class Login(BaseModel):
    email: EmailStr
    password: str

class SocialLogin(BaseModel):
    access_token: str

class EmailFind(BaseModel):
    phone_number: str
    birthdate: str

class PhoneVerificationRequest(BaseModel):
    phone_number: str

class PhoneVerificationVerify(BaseModel):
    phone_number: str
    verification_code: str

class PasswordReset(BaseModel):
    email: EmailStr
    new_password: str
    new_password_confirmation: str

class Msg(BaseModel):
    message: str

class EmailCheckRequest(BaseModel):
    email: str