from decimal import Decimal
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# 상품 조회
class SubscriptionPlanSchema(BaseModel):
    plan_id: int
    plan_name: str
    price: Decimal
    discounted_price: Decimal
    tokens_included: int
    description: Optional[str]
    is_promotion: bool
    promotion_details: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        from_attributes = True  # 추가

class TokenPlanSchema(BaseModel):
    token_plan_id: int
    tokens: int
    price: Decimal
    discounted_price: Decimal
    discount_rate: Decimal
    is_promotion: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        from_attributes = True  # 추가

# 결제 
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
    payment_id: UUID
    user_id: UUID
    subscription_id: Optional[int]
    token_plan_id: Optional[int]
    payment_number: str
    transaction_number: Optional[str]
    tokens_purchased: Optional[int]
    amount: float
    payment_method: str
    payment_date: datetime
    status: str
    manual_payment_reason: Optional[str]

    class Config:
        from_attributes = True

class PaycancelResponse(BaseModel):
    inquiry_id: int = Field(..., description="문의 ID")
    refund_id: int = Field(..., description="환불 ID")
    payment_number: str = Field(..., description="결제 번호")
    status: str = Field(..., description="환불 상태")
    message: str = Field(..., description="응답 메시지")

    class Config:
        json_schema_extra = {
            "example": {
                "inquiry_id": 123,
                "refund_id": 456,
                "payment_number": "T7767de...",
                "status": "CANCELLATION_REQUESTED",
                "message": "환불 요청과 문의가 성공적으로 접수되었습니다."
            }
        }

# 쿠폰
class CouponCreate(BaseModel):
    coupon_code: str = Field(..., max_length=20)
    discount_type: str  # 'RATE' or 'AMOUNT'
    discount_value: float
    valid_from: datetime
    valid_to: datetime
    max_usage: Optional[int] = None

class CouponUpdate(BaseModel):
    discount_type: Optional[str]
    discount_value: Optional[float]
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]
    max_usage: Optional[int] = None

class CouponResponse(BaseModel):
    coupon_id: int
    coupon_code: str
    discount_type: str
    discount_value: float
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]
    max_usage: Optional[int]
    used_count: Optional[int]

    class Config:
        from_attributes = True

class CouponValidationRequest(BaseModel):
    coupon_code: str

class CouponValidationResponse(BaseModel):
    discount_value: int
    is_valid: bool
    reason: Optional[str] = None

# admin 
class AdminPaymentCreate(BaseModel):
    user_id: UUID
    subscription_id: Optional[int] = None
    token_plan_id: Optional[int] = None
    payment_method: str = "manual"
    manual_payment_reason: str

class PaymentAdminResponse(BaseModel):
    payment_id: UUID
    user_id: UUID
    subscription_id: Optional[int]
    token_plan_id: Optional[int]
    payment_method: str
    manual_payment_reason: Optional[str]
    amount: float
    status: str
    payment_date: datetime

    class Config:
        from_attributes = True

class RefundResponse(BaseModel):
    refund_id: int
    payment_id: UUID
    amount: float
    reason: Optional[str]
    status: str
    processed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
        from_attributes = True

class AdminPaymentListResponse(BaseModel):
    payment_id: UUID
    user_nickname: Optional[str]
    product_name: Optional[str]  # 상품 정보가 필요하면 추가
    amount: float
    payment_method: str
    status: str
    payment_date: datetime
    refund: Optional[RefundResponse]  # 환불 정보 포함

    class Config:
        from_attributes = True

class InquiryResponse(BaseModel):
    inquiry_id: int
    type: str
    title: str
    email: str
    contact: str
    content: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AdminPaymentDetailResponse(BaseModel):
    payment_id: UUID
    payment_number: str
    amount: float
    status: str
    payment_date: datetime
    payment_method: str
    user_nickname: Optional[str]
    refund: Optional[RefundResponse]
    inquiries: Optional[List[InquiryResponse]]

    class Config:
        from_attributes = True

#portone
class OneTimePaymentRequest(BaseModel):
    plan_id: int  # Token plan ID
    pg: str  # 'kakaopay', 'danal', 'danal_tpay', etc.
    pay_method: Optional[str] = None  # 'card', 'trans', 'vbank', etc. (Optional for flexibility)
    coupon_code: Optional[str] = None

class SubscriptionPaymentRequest(BaseModel):
    plan_id: int
    pg: str
    coupon_code: Optional[str] = None

class PaymentCompleteRequest(BaseModel):
    imp_uid: str
    merchant_uid: str

class PortoneRequest:
    imp_uid: str
    merchant_uid: str
    expected_amount: int
    user_id: str
    token_plan_id: int = None
    subscription_id: int = None
    next_billing_date: str = None  # For subscription payments

class SubscriptionChangeRequest(BaseModel):
    user_id: UUID = Field(..., description="사용자 ID")
    new_plan_id: int = Field(..., description="새 구독 플랜 ID")