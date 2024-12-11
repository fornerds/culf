from pydantic import BaseModel
from datetime import datetime, date
from uuid import UUID
from typing import Optional
from datetime import datetime

class TokenInfo(BaseModel):
    total_tokens: int
    used_tokens: int
    last_charged_at: Optional[datetime]

    class Config:
        orm_mode = True

class TokenPlanBase(BaseModel):
    tokens: int
    price: float
    discounted_price: float
    discount_rate: float
    is_promotion: bool

class TokenPlanCreate(TokenPlanBase):
    pass

class TokenPlanUpdate(TokenPlanBase):
    pass

class TokenPlanResponse(TokenPlanBase):
    token_plan_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class UserTokenResponse(BaseModel):
    token_id: int
    user_id: UUID
    total_tokens: int
    used_tokens: int
    last_charged_at: Optional[datetime] = None
    expires_at: Optional[date] = None

    class Config:
        orm_mode = True
