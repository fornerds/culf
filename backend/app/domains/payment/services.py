from fastapi import Depends, HTTPException, status
from sqlalchemy import extract, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from app.db.session import get_db
from app.domains.payment import schemas as payment_schemas
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon
from app.domains.token.models import Token, TokenPlan 
from app.domains.user.models import User
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.domains.inquiry.models import Inquiry
from uuid import UUID
import requests
import os
import uuid
import logging

logger = logging.getLogger("app")

def get_all_products(db: Session):
    subscription_plans = db.query(SubscriptionPlan).all()
    token_plans = db.query(TokenPlan).all()
    return {"subscription_plans": subscription_plans, "token_plans": token_plans}

def get_product_by_id(db: Session, product_id: int, product_type: str):
    if product_type == "subscription":
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == product_id).first()
    elif product_type == "token":
        return db.query(TokenPlan).filter(TokenPlan.token_plan_id == product_id).first()
    return None

# 껍데기 코드 수정 필요
def create_payment(db: Session, payment_data: Payment):
    payment_record = Payment(
        user_id=payment_data.user_id,
        subscription_id=payment_data.subscription_id,
        token_plan_id=payment_data.token_plan_id,
        payment_number="PAY123456",
        tokens_purchased=payment_data.tokens_purchased,
        amount=payment_data.amount,
        payment_method=payment_data.payment_method,
        payment_date=datetime.utcnow(),
        status='SUCCESS',
    )
    db.add(payment_record)
    db.commit()
    db.refresh(payment_record)
    return payment_record

def get_me_payments(db: Session, user_id: int, page: int = 1, limit: int = 10, year: int = None, month: int = None):
    offset = (page - 1) * limit
    query = db.query(Payment).filter(Payment.user_id == user_id)

    if year:
        query = query.filter(extract('year', Payment.payment_date) == year)
    if month:
        query = query.filter(extract('month', Payment.payment_date) == month)

    return query.offset(offset).limit(limit).all()

def get_payment_detail(db: Session, payment_id: int):
    return db.query(Payment).filter(Payment.payment_id == payment_id).first()

def inquiry_payment(db: Session, payment_id: UUID, user_id: str, refund_request: payment_schemas.PaycancelRequest):
    payment = db.query(Payment).filter(Payment.payment_id == payment_id, Payment.user_id == user_id).first()
    if not payment:
        return None

    inquiry = Inquiry(
        user_id=user_id,
        type="payment",
        title=refund_request.title,
        email=refund_request.email,
        contact=refund_request.contact,
        content=refund_request.content,
        attachment=refund_request.attachment,
        status="PENDING",
        created_at=datetime.now()
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)

    refund = Refund(
        payment_id=payment.payment_id,
        user_id=user_id,
        inquiry_id=inquiry.inquiry_id,
        amount=payment.amount,
        reason=refund_request.content,
        status="PENDING",
        created_at=datetime.now()
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)

    return {"inquiry": inquiry, "refund": refund}

def create_refund(db: Session, refund_data: Refund):
    db.add(refund_data)
    db.commit()
    db.refresh(refund_data)
    return refund_data

def get_refunds(db: Session, user_id: int, page: int = 1, limit: int = 10):
    offset = (page - 1) * limit
    return db.query(Refund).filter(Refund.user_id == user_id).offset(offset).limit(limit).all()

def get_refund_detail(db: Session, refund_id: int):
    return db.query(Refund).filter(Refund.refund_id == refund_id).first()

def process_refund(db: Session, refund_id: int, processed_by: int):
    refund = db.query(Refund).filter(Refund.refund_id == refund_id).first()
    if refund:
        refund.status = 'APPROVED'
        refund.processed_at = datetime.now().date()
        refund.processed_by = processed_by
        db.commit()
        db.refresh(refund)
        return refund
    return None

# 쿠폰 사용 관련 서비스 코드
def get_coupon_by_code(db, coupon_code):
    logger.info(f"Fetching coupon with code: {coupon_code}")
    coupon = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
    if not coupon:
        logger.warning(f"No coupon found with code: {coupon_code}")
    else:
        logger.info(f"Coupon details: {coupon}")
    return coupon

def calculate_discount(coupon: Coupon, original_price: float) -> float:
    if coupon.discount_type == "RATE":
        return original_price * (coupon.discount_value / 100)
    elif coupon.discount_type == "AMOUNT":
        return coupon.discount_value
    return 0

def record_coupon_usage(db: Session, user_id: str, coupon_id: int):
    user_coupon = UserCoupon(user_id=user_id, coupon_id=coupon_id, used_at=datetime.now())
    db.add(user_coupon)
    db.commit()

def create_coupon(db: Session, coupon_data: payment_schemas.CouponCreate):
    coupon = Coupon(**coupon_data.dict())
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon

def update_coupon(db: Session, coupon_id: int, coupon_data: payment_schemas.CouponUpdate):
    coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    
    for key, value in coupon_data.dict(exclude_unset=True).items():
        setattr(coupon, key, value)

    db.commit()
    db.refresh(coupon)
    return coupon

def delete_coupon(db: Session, coupon_id: int):
    coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    
    db.delete(coupon)
    db.commit()

def get_coupon(db: Session, coupon_id: int):
    coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    return coupon

def validate_coupon(db: Session, coupon_code: str, user_id: str):
    coupon = db.query(Coupon).filter(Coupon.coupon_code == coupon_code).first()
    if not coupon:
        return payment_schemas.CouponValidationResponse(is_valid=False, reason="Coupon not found")

    today = datetime.now().date()
    if coupon.valid_from and coupon.valid_to:
        if today < coupon.valid_from or today > coupon.valid_to:
            return payment_schemas.CouponValidationResponse(is_valid=False, reason="Coupon is expired or not yet valid")

    if coupon.max_usage and coupon.used_count >= coupon.max_usage:
        return payment_schemas.CouponValidationResponse(is_valid=False, reason="Coupon usage limit exceeded")

    user_coupon = db.query(UserCoupon).filter(UserCoupon.user_id == user_id, UserCoupon.coupon_id == coupon.coupon_id).first()
    if user_coupon:
        return payment_schemas.CouponValidationResponse(is_valid=False, reason="Coupon already used by the user")

    return payment_schemas.CouponValidationResponse(is_valid=True)

# admin
def get_payment_detail(db: Session, payment_id: UUID):
    payment = (
        db.query(Payment)
        .filter(Payment.payment_id == payment_id)
        .options(
            joinedload(Payment.refunds),
            joinedload(Payment.user),
        )
        .first()
    )

    if not payment:
        return None

    refund = None
    if payment.refunds:
        refund_obj = payment.refunds[0]
        refund = {
            "refund_id": refund_obj.refund_id,
            "payment_id": refund_obj.payment_id,
            "amount": refund_obj.amount,
            "reason": refund_obj.reason,
            "status": refund_obj.status,
            "processed_at": refund_obj.processed_at,
            "created_at": refund_obj.created_at,
        }

    inquiries = []
    if payment.refunds:
            if refund.inquiry:
                inquiry = refund.inquiry
                inquiries.append({
                    "inquiry_id": inquiry.inquiry_id,
                    "type": inquiry.type,
                    "title": inquiry.title,
                    "email": inquiry.email,
                    "contact": inquiry.contact,
                    "content": inquiry.content,
                    "status": inquiry.status,
                    "created_at": inquiry.created_at,
                })

    return {
        "payment_id": payment.payment_id,
        "payment_number": payment.payment_number,
        "amount": payment.amount,
        "status": payment.status,
        "payment_date": payment.payment_date,
        "payment_method": payment.payment_method,
        "user_nickname": payment.user.nickname if payment.user else None,
        "refund": refund,
        "inquiries": inquiries,
    }

# 수동 결제 처리 껍데기 코드
def create_manual_payment(db: Session, payment_data: dict) -> Payment:
    payment = Payment(**payment_data)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
# 환불 처리 껍데기 코드
def process_refund(db: Session, payment_id: UUID, refund_data: dict) -> Refund:
    refund = Refund(payment_id=payment_id, **refund_data)
    db.add(refund)
    db.commit()
    db.refresh(refund)
    return refund

def get_admin_payments(
    db: Session,
    query: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    page: int,
    limit: int,
    sort: str
) -> List[payment_schemas.PaymentListResponse]:
    query_builder = db.query(
        Payment,
        User.nickname.label("user_nickname"),
        Refund
    ).join(User, Payment.user_id == User.user_id, isouter=True).join(
        Refund, Payment.payment_id == Refund.payment_id, isouter=True
    )

    if query:
        query_builder = query_builder.filter(
            or_(
                Payment.payment_id.ilike(f"%{query}%"),
                User.nickname.ilike(f"%{query}%"),
                Payment.payment_method.ilike(f"%{query}%"),
                Payment.manual_payment_reason.ilike(f"%{query}%") 
            )
        )

    if start_date and end_date:
        query_builder = query_builder.filter(
            Payment.payment_date.between(start_date, end_date)
        )

    sort_column, sort_direction = sort.split(":")
    if sort_direction == "desc":
        query_builder = query_builder.order_by(getattr(Payment, sort_column).desc())
    else:
        query_builder = query_builder.order_by(getattr(Payment, sort_column))

    results = query_builder.offset((page - 1) * limit).limit(limit).all()

    payments = []
    for payment, user_nickname, refund in results:
        payments.append(
            payment_schemas.PaymentListResponse(
                payment_id=payment.payment_id,
                user_nickname=user_nickname,
                product_name=None, 
                amount=payment.amount,
                payment_method=payment.payment_method,
                status=payment.status,
                payment_date=payment.payment_date,
                refund=payment_schemas.RefundResponse.from_orm(refund) if refund else None
            )
        )

    return payments

# 카카오 페이 서비스
def __init__(self):
    self.base_url = "https://open-api.kakaopay.com/online/v1/payment"
    self.secret_key = os.getenv("SECRET_KEY")
    self.cid_one = os.getenv("CID_ONE")
    self.cid_sub = os.getenv("CID_SUB")
    self.cid_seq = os.getenv("CID_SEQ")
    self.dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    self.cache_store = None

def set_cache(self, value):
    global global_cache
    global_cache = value

def get_cache(self):
    global global_cache
    return global_cache

def get_token_plan(self, db: Session, plan_id: int):
    token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == plan_id).first()
    if not token_plan:
        raise HTTPException(status_code=404, detail="Token plan not found")
    return token_plan

def initiate_payment(self, payment_request: payment_schemas.KakaoPayRequest, token_plan: TokenPlan, db: Session, current_user: User):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    discount_amount = Decimal(0)
    coupon = None

    if payment_request.coupon_code:
        coupon = get_coupon_by_code(db, payment_request.coupon_code)
        if not coupon:
            raise HTTPException(status_code=400, detail="유효하지 않은 쿠폰 코드입니다.")
        
        if coupon.discount_type == 'AMOUNT':
            discount_amount = Decimal(coupon.discount_value)
        elif coupon.discount_type == 'RATE':
            discount_amount = Decimal(token_plan.price) * Decimal(coupon.discount_value / 100)

        if coupon.used_count >= (coupon.max_usage or 0):
            raise HTTPException(status_code=400, detail="사용 한도가 초과된 쿠폰입니다.")
        if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
            raise HTTPException(status_code=400, detail="쿠폰 사용 기간이 아닙니다.")

    total_amount = max(Decimal(token_plan.price) - discount_amount, Decimal(0)) * payment_request.quantity
    partner_order_id = str(uuid.uuid4())
    data = {
        "cid": self.cid_one,
        "partner_order_id": partner_order_id,
        "partner_user_id": str(current_user.user_id),
        "item_name": f"{token_plan.tokens} tokens",
        "quantity": payment_request.quantity,
        "total_amount": float(total_amount),
        "vat_amount": 0,
        "tax_free_amount": 0,
        "approval_url": "http://localhost:8000/v1/pay/success",
        "cancel_url": "http://localhost:8000/v1/pay/cancel",
        "fail_url": "http://localhost:8000/v1/pay/fail",
    }

    try:
        response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
        response_data = response.json()

        logger.info(f"API response status: {response.status_code}, response data: {response_data}")
        logger.info(f"Sent data for payment: {data}")
        
        if response.status_code == 200:
            tid = response_data.get("tid")

            payment = Payment(
                payment_id=partner_order_id,
                user_id=current_user.user_id,
                token_plan_id=token_plan.token_plan_id,
                payment_number=tid,
                tokens_purchased=token_plan.tokens * payment_request.quantity,
                amount=float(total_amount),
                payment_method="KakaoPay_OneTime",
                payment_date=datetime.now(),
                used_coupon_id=coupon.coupon_id if coupon else None,
                status="CANCELLED"
            )
            db.add(payment)
            db.commit()
            
            self.set_cache({
                "cid": self.cid_one,
                "tid": tid,
                "partner_order_id": partner_order_id,
                "partner_user_id": str(current_user.user_id)
            })
            cached_data = self.get_cache()
            logger.info(f"Immediately retrieved cache after setting: {cached_data}")
            
            if payment_request.environment == "pc":
                redirect_url = response_data.get("next_redirect_pc_url")
            elif payment_request.environment == "mobile":
                redirect_url = response_data.get("next_redirect_mobile_url")
            elif payment_request.environment == "app":
                redirect_url = response_data.get("next_redirect_app_url")
            else:
                raise HTTPException(status_code=400, detail="Invalid environment specified")

            return {"redirect_url": redirect_url}
        else:
            logger.error(f"Payment initiation failed: {response_data.get('msg')}")
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database IntegrityError: {str(e)}")
        raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during payment initiation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

def approve_payment(self, pg_token: str, db: Session):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    payment_info = self.get_cache()
    if not payment_info:
        logger.error("Failed to retrieve payment information from cache.")
        raise HTTPException(status_code=400, detail="Failed to retrieve payment information.")

    try:
        data = {
            "cid": payment_info["cid"],
            "tid": payment_info["tid"],
            "partner_order_id": payment_info["partner_order_id"],
            "partner_user_id": payment_info["partner_user_id"],
            "pg_token": pg_token,
        }

        response = requests.post(f"{self.base_url}/approve", headers=headers, json=data)
        response_data = response.json()

        if response.status_code == 200:
            payment = db.query(Payment).filter(Payment.payment_number == payment_info["tid"]).first()
            if payment:
                payment.status = "SUCCESS"
                payment.transaction_number = response_data.get("aid")
                payment.payment_date = response_data.get("approved_at")
                db.commit()

                logger.info(f"Payment subscription_id: {payment.subscription_id}")

                if payment_info["cid"] == "TCSUBSCRIP":
                    user_subscription = db.query(UserSubscription).filter(
                        UserSubscription.subscription_id == payment.subscription_id
                    ).first()

                    if user_subscription:
                        logger.info(f"User subscription found: {user_subscription}")
                    else:
                        logger.error(f"User subscription not found for subscription_id: {payment.subscription_id}")

                    if user_subscription:
                        user_subscription.subscription_number = response_data.get("sid")
                        user_subscription.status = "ACTIVE"
                        db.commit()

                        logger.info(f"User subscription updated successfully for user_id: {payment.user_id}")

                token = db.query(Token).filter(Token.user_id == payment.user_id).first()

                if not token:
                    token = Token(
                        user_id=payment.user_id,
                        total_tokens=payment.tokens_purchased,
                        used_tokens=0,
                        last_charged_at=payment.payment_date,
                        expires_at=payment.payment_date + timedelta(days=365),
                    )
                    db.add(token)
                    logger.info(f"New token entry created for user_id: {payment.user_id}")
                else:
                    token.total_tokens += payment.tokens_purchased
                    token.last_charged_at = payment.payment_date
                    token.expires_at = payment.payment_date + timedelta(days=365)
                    logger.info(f"Token entry updated for user_id: {payment.user_id}")

                db.commit()

            return payment_schemas.KakaoPayApproval(**response_data)
        else:
            logger.error(f"Payment approval failed with response: {response_data}")
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    except Exception as e:
        logger.error(f"Exception occurred during payment approval process: {str(e)}")
        raise HTTPException(status_code=400, detail="An error occurred while processing the payment approval.")

def initiate_subscription(self, subscription_request: payment_schemas.KakaoPaySubscriptionRequest, db: Session, current_user: User):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == subscription_request.plan_id
    ).first()

    if not subscription_plan:
        raise HTTPException(status_code=404, detail="Invalid subscription plan")

    discount_amount = Decimal(0)
    coupon = None

    if subscription_request.coupon_code:
        coupon = get_coupon_by_code(db, subscription_request.coupon_code)
        if not coupon:
            raise HTTPException(status_code=400, detail="유효하지 않은 쿠폰 코드입니다.")

        if coupon.discount_type == 'AMOUNT':
            discount_amount = Decimal(coupon.discount_value)
        elif coupon.discount_type == 'RATE':
            discount_amount = Decimal(subscription_plan.discounted_price) * Decimal(coupon.discount_value / 100)

        if coupon.used_count >= (coupon.max_usage or 0):
            raise HTTPException(status_code=400, detail="사용 한도가 초과된 쿠폰입니다.")
        if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
            raise HTTPException(status_code=400, detail="쿠폰 사용 기간이 아닙니다.")

    total_amount = max(Decimal(subscription_plan.discounted_price) - discount_amount, Decimal(0)) * subscription_request.quantity
    partner_order_id = str(uuid.uuid4())
    data = {
        "cid": self.cid_sub,
        "partner_order_id": partner_order_id,
        "partner_user_id": str(current_user.user_id),
        "item_name": subscription_plan.plan_name,
        "quantity": 1,
        "total_amount": float(total_amount),
        "vat_amount": 0,
        "tax_free_amount": 0,
        "approval_url": "http://localhost:8000/v1/pay/success",
        "cancel_url": "http://localhost:8000/v1/pay/cancel",
        "fail_url": "http://localhost:8000/v1/pay/fail",
    }

    try:
        response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
        response_data = response.json()
        
        logger.info(f"API response status: {response.status_code}, response data: {response_data}")
        logger.info(f"Sent data for subscription payment: {data}")

        if response.status_code == 200:
            tid = response_data.get("tid")

            subscription = UserSubscription(
                user_id=current_user.user_id,
                plan_id=subscription_plan.plan_id,
                start_date=datetime.now().date(),
                next_billing_date=(datetime.now() + timedelta(days=30)).date(),
                status="CANCELLED",
                subscriptions_method="KakaoPay_Subscription"
            )
            db.add(subscription)
            db.commit()
            db.refresh(subscription)

            payment = Payment(
                payment_id=partner_order_id,
                user_id=current_user.user_id,
                subscription_id=subscription.subscription_id,
                payment_number=tid,
                tokens_purchased=subscription_plan.tokens_included * subscription_request.quantity, 
                amount=float(total_amount),
                payment_method="KakaoPay_Subscription",
                payment_date=datetime.now(),
                used_coupon_id=coupon.coupon_id if coupon else None,
                status="CANCELLED"
            )
            db.add(payment)
            db.commit()

            self.set_cache({
                "cid": self.cid_sub,
                "tid": tid,
                "partner_order_id": partner_order_id,
                "partner_user_id": str(current_user.user_id),
                "subscription_id": subscription.subscription_id
            })
            cached_data = self.get_cache()
            logger.info(f"Immediately retrieved cache after setting: {cached_data}")

            if subscription_request.environment == "pc":
                redirect_url = response_data.get("next_redirect_pc_url")
            elif subscription_request.environment == "mobile":
                redirect_url = response_data.get("next_redirect_mobile_url")
            elif subscription_request.environment == "app":
                redirect_url = response_data.get("next_redirect_app_url")
            else:
                raise HTTPException(status_code=400, detail="Invalid environment specified")

            return {"redirect_url": redirect_url}
        else:
            logger.error(f"Subscription initiation failed: {response_data.get('msg')}")
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    except IntegrityError as e:
        db.rollback()
        logger.error(f"Database IntegrityError: {str(e)}")
        raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during subscription initiation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

def pay_subscription(self, db: Session = Depends(get_db)):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    today = datetime.now().date()
    active_subscriptions = db.query(UserSubscription).filter(
        UserSubscription.next_billing_date == today,
        UserSubscription.status == "ACTIVE"
    ).all()

    if not active_subscriptions:
        logger.info("No active subscriptions to process today.")
        return

    for subscription in active_subscriptions:
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == subscription.plan_id
        ).first()
        if not subscription_plan:
            logger.error(f"Subscription plan not found for plan_id: {subscription.plan_id}")
            continue

        data = {
            "cid": self.cid_sub,
            "sid": subscription.subscription_number,
            "partner_order_id": f"{uuid.uuid4()}",
            "partner_user_id": subscription.user_id,
            "item_name": subscription_plan.plan_name,
            "quantity": 1,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
        }
        response = requests.post(f"{self.base_url}/subscription", headers=headers, json=data)
        response_data = response.json()

        if response.status_code == 200:
            logger.info(f"Subscription payment successful for user_id: {subscription.user_id}")
            payment = Payment(
                payment_id=f"order_{uuid.uuid4()}",
                user_id=subscription.user_id,
                subscription_id=subscription.subscription_id,
                payment_number=response_data.get("tid"),
                amount=float(subscription_plan.price),
                payment_method="KakaoPay_subscription",
                payment_date=datetime.now(),
                status="SUCCESS",
                transaction_number=response_data.get("aid")
            )
            db.add(payment)

            subscription.next_billing_date = today + timedelta(days=subscription_plan.billing_cycle)
            db.commit()
        else:
            logger.error(f"Subscription payment failed for user_id: {subscription.user_id}, reason: {response_data.get('msg')}")

    logger.info("Subscription payments processed.")

def cancel_subscription(self, user_id: str, db: Session = Depends(get_db)):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == 'ACTIVE'
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found for the given user_id")

    data = {
        "cid": self.cid_sub,
        "sid": subscription.subscription_number,
    }

    response = requests.post(f"{self.base_url}/manage/subscription/inactive", headers=headers, json=data)
    response_data = response.json()

    if response.status_code == 200:
        subscription.status = 'CANCELLED'
        db.commit()
        return response_data
    else:
        raise HTTPException(status_code=400, detail=response_data.get("msg"))

def get_subscription_status(self, user_id: str, db: Session = Depends(get_db)):
    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.status == 'ACTIVE'
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found for the given user_id")

    data = {
        "cid": self.cid_sub,
        "sid": subscription.subscription_number,
    }

    response = requests.post(f"{self.base_url}/manage/subscription/status", headers=headers, json=data)
    response_data = response.json()

    if response.status_code == 200:
        return response_data
    else:
        raise HTTPException(status_code=400, detail=response_data.get("msg"))

def process_refund(self, payment_id: uuid, refund_data: dict, db: Session):
    payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    cancel_amount = refund_data.get("amount")
    if not cancel_amount or cancel_amount <= 0 or cancel_amount > payment.amount:
        raise HTTPException(status_code=400, detail="Invalid refund amount")

    headers = {
        "Authorization": f"SECRET_KEY {self.secret_key}",
        "Content-Type": "application/json",
    }

    data = {
        "cid": self.cid_one,
        "tid": payment.payment_number,
        "cancel_amount": cancel_amount,
        "cancel_tax_free_amount": refund_data.get("cancel_tax_free_amount", 0),
        "cancel_vat_amount": refund_data.get("cancel_vat_amount"),
    }

    try:
        response = requests.post(f"{self.base_url}/cancel", headers=headers, json=data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"KakaoPay API request failed: {str(e)}")

    response_data = response.json()

    if response.status_code != 200 or response_data.get("status") not in ["CANCEL_PAYMENT", "PART_CANCEL_PAYMENT"]:
        error_message = response_data.get("error_message", "Unknown error occurred")
        raise HTTPException(status_code=400, detail=f"Refund failed: {error_message}")

    refund = Refund(
        payment_id=payment.payment_id,
        user_id=payment.user_id,
        amount=cancel_amount,
        reason=refund_data.get("reason", "No reason provided"),
        status="APPROVED",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    payment.status = "CANCEL_PAYMENT" if response_data.get("status") == "CANCEL_PAYMENT" else "PART_CANCEL_PAYMENT"

    db.add(refund)
    db.commit()
    db.refresh(refund)

    return refund

