from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PaymentBase(BaseModel):
    user_id: int
    amount: float
    payment_method: str
    used_coupon_id: Optional[int] = None

class PaymentCreate(PaymentBase):
    subscription_id: Optional[int] = None
    token_plan_id: Optional[int] = None
    tokens_purchased: Optional[int] = None

class PaymentResponse(PaymentBase):
    payment_id: int
    payment_number: str
    payment_date: datetime
    status: str

    class Config:
        orm_mode = True

class RefundBase(BaseModel):
    payment_id: int
    user_id: int
    amount: float
    reason: Optional[str]
    status: Optional[str] = 'PENDING'

class RefundResponse(RefundBase):
    refund_id: int
    processed_at: Optional[datetime]
    processed_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CouponBase(BaseModel):
    coupon_code: str
    discount_type: str
    discount_value: float
    valid_from: datetime
    valid_to: datetime
    max_usage: Optional[int]
    used_count: Optional[int] = 0

class CouponResponse(CouponBase):
    coupon_id: int

    class Config:
        orm_mode = True

class UserCouponBase(BaseModel):
    user_id: str
    coupon_id: int
    used_at: Optional[datetime]

class UserCouponResponse(UserCouponBase):
    class Config:
        orm_mode = True


# 카카오페이
class KakaoPayRequest(BaseModel):
    partner_order_id: str
    partner_user_id: str
    item_name: str
    quantity: int
    total_amount: float
    user_id: int
    plan_id: Optional[int] 

class KakaoPaySubscriptionRequest(BaseModel):
    partner_order_id: str
    partner_user_id: str
    item_name: str
    quantity: int
    total_amount: float
    user_id: int
    plan_id: int  
    sid: Optional[str]  

class KakaoPayApproval(BaseModel):
    aid: str
    tid: str
    cid: str
    partner_order_id: str
    partner_user_id: str
    payment_method_type: str
    amount: dict
    item_name: Optional[str]
    created_at: datetime
    approved_at: datetime

class KakaoPayRefundRequest(BaseModel):
    payment_id: int
    amount: float
    reason: Optional[str]