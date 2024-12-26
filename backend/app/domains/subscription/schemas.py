from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime

class SubscriptionPlanResponse(BaseModel):
    plan_id: int
    plan_name: str
    price: float
    discounted_price: float
    tokens_included: int
    description: Optional[str] = None
    is_promotion: bool
    promotion_details: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class UserSubscriptionResponse(BaseModel):
    subscription_id: int
    user_id: UUID
    plan_id: int
    start_date: date
    next_billing_date: date
    status: str
    subscription_number: Optional[str] = None
    subscriptions_method: str

    class Config:
        orm_mode = True

class UserSubscriptionUpdate(BaseModel):
    plan_id: Optional[int] = None  # 변경할 구독 플랜 ID
