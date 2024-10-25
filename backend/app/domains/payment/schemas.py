from pydantic import BaseModel
from typing import Optional, List
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
class KakaoPaySubscriptionRequest(BaseModel):
    partner_user_id: str
    quantity: int
    plan_id: int  
    coupon_id: Optional[int] = None

class KakaoPayRequest(BaseModel):
    partner_user_id: str
    quantity: int
    plan_id: int
    coupon_id: Optional[int] = None

class Amount(BaseModel):
    total: int
    tax_free: int
    vat: int
    point: int
    discount: int
    green_deposit: int

class CardInfo(BaseModel):
    interest_free_install: str
    bin: str
    card_type: str
    card_mid: str
    approved_id: str
    install_month: str
    installment_type: Optional[str] = None  # 선택 사항
    kakaopay_purchase_corp: str
    kakaopay_purchase_corp_code: str
    kakaopay_issuer_corp: str
    kakaopay_issuer_corp_code: str

class SequentialPaymentMethod(BaseModel):
    payment_priority: int
    sid: str
    payment_method_type: str
    card_info: Optional[CardInfo] = None  # 선택 사항, 카드 결제일 경우

class KakaoPayApproval(BaseModel):
    tid: str
    aid: str
    cid: str
    sid: Optional[str] = None  # 정기 결제일 경우
    partner_order_id: str
    partner_user_id: str
    payment_method_type: str
    item_name: str
    quantity: int
    amount: Amount
    card_info: Optional[CardInfo] = None  # 카드 결제일 경우
    sequential_payment_methods: Optional[List[SequentialPaymentMethod]] = None  # 정기 결제 시 순차결제일 경우
    created_at: datetime
    approved_at: datetime
