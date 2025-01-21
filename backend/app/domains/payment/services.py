from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import extract, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID
import requests
import uuid
import logging

from app.domains.payment import schemas as payment_schemas
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon, PaymentCache
from app.domains.token.models import Token, TokenPlan 
from app.domains.user.models import User
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.domains.inquiry.models import Inquiry
from app.domains.inquiry import schemas as inquiry_schemas
from app.core.config import settings


logger = logging.getLogger("app")

def get_all_products(db: Session):
    subscription_plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price.asc()).all()
    token_plans = db.query(TokenPlan).order_by(TokenPlan.price.asc()).all()
    return {"subscription_plans": subscription_plans, "token_plans": token_plans}

def get_product_by_id(db: Session, product_id: int, product_type: str):
    if product_type == "subscription":
        return db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == product_id).first()
    elif product_type == "token":
        return db.query(TokenPlan).filter(TokenPlan.token_plan_id == product_id).first()
    return None

def get_me_payments(db: Session, user_id: int, page: int = 1, limit: int = 10, year: int = None, month: int = None):
    offset = (page - 1) * limit
    query = db.query(Payment).filter(Payment.user_id == user_id)

    if year:
        query = query.filter(extract('year', Payment.payment_date) == year)
    if month:
        query = query.filter(extract('month', Payment.payment_date) == month)

    return query.offset(offset).limit(limit).all()

def cancel_payment_with_inquiry(db: Session, payment_id: UUID, user_id: UUID, inquiry_data: inquiry_schemas.InquiryCreate):
    payment = db.query(Payment).filter(
        Payment.payment_id == payment_id,
        Payment.user_id == user_id,
    ).first()

    if not payment:
        return None

    try:
        inquiry = Inquiry(
            user_id=user_id,
            type="PAYMENT",
            title=inquiry_data.title,
            email=inquiry_data.email,
            contact=inquiry_data.contact,
            content=inquiry_data.content,
            attachments=jsonable_encoder(inquiry_data.attachments) if inquiry_data.attachments else None,
            status="PENDING",
            created_at=datetime.now(),
        )
        db.add(inquiry)
        db.commit()
        db.refresh(inquiry)

        # 환불 데이터 생성
        refund = Refund(
            payment_id=payment.payment_id,
            user_id=user_id,
            inquiry_id=inquiry.inquiry_id,
            amount=payment.amount,
            reason=inquiry_data.content,
            status="PENDING",
            created_at=datetime.now(),
        )
        db.add(refund)
        db.commit()
        db.refresh(refund)

        return {"inquiry": inquiry, "refund": refund}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create payment cancellation inquiry: {str(e)}")

def get_refund_detail(db: Session, refund_id: int):
    return db.query(Refund).filter(Refund.refund_id == refund_id).first()


def get_coupons(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = False
) -> List[Coupon]:
    try:
        query = db.query(Coupon)

        if active_only:
            current_date = datetime.now().date()
            query = query.filter(
                Coupon.valid_from <= current_date,
                Coupon.valid_to >= current_date
            )

        # max_usage가 설정된 경우 사용 횟수가 남은 쿠폰만 필터링
        if active_only:
            query = query.filter(
                or_(
                    Coupon.max_usage.is_(None),
                    Coupon.used_count < Coupon.max_usage
                )
            )

        return query.order_by(Coupon.coupon_id.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching coupons: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch coupons")

def get_coupon_by_code(db, coupon_code):
    logger.info(f"Fetching coupon with code: {coupon_code}")
    coupon = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
    if not coupon:
        logger.warning(f"No coupon found with code: {coupon_code}")
    else:
        logger.info(f"Coupon details: {coupon}")
    return coupon

def validate_coupon(db: Session, coupon_code: str, user_id: str):
    coupon = db.query(Coupon).filter(Coupon.coupon_code == coupon_code).first()
    if not coupon:
        return {
            "is_valid": False,
            "discount_value": 0,
            "message": "유효하지 않은 쿠폰입니다. (쿠폰을 찾을 수 없습니다.)"
        }
    today = datetime.now().date()
    if coupon.valid_from and coupon.valid_to:
        if today < coupon.valid_from or today > coupon.valid_to:
            return {
                "is_valid": False,
                "discount_value": 0,
                "message": "유효하지 않은 쿠폰입니다. (쿠폰이 만료되었거나 아직 유효하지 않습니다.)"
            }
    if coupon.max_usage and coupon.used_count >= coupon.max_usage:
        return {
            "is_valid": False,
            "discount_value": 0,
            "message": "유효하지 않은 쿠폰입니다. (쿠폰 사용 가능 횟수가 초과되었습니다.)"
        }
    user_coupon = db.query(UserCoupon).filter(UserCoupon.user_id == user_id, UserCoupon.coupon_id == coupon.coupon_id).first()
    if user_coupon:
        return {
            "is_valid": False,
            "discount_value": 0,
            "message": "유효하지 않은 쿠폰입니다. (해당 사용자가 이미 쿠폰을 사용했습니다.)"
        }
    discount_value = coupon.discount_value
    return {
        "is_valid": True,
        "discount_value": discount_value,
        "message": "유효한 쿠폰입니다."
    }


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
    inquiries = []
    if payment.refunds:  # 리스트로 반환되므로 첫 번째 항목 사용
        refund_obj = payment.refunds[0] if payment.refunds else None
        if refund_obj:
            refund = {
                "refund_id": refund_obj.refund_id,
                "payment_id": refund_obj.payment_id,
                "amount": refund_obj.amount,
                "reason": refund_obj.reason,
                "status": refund_obj.status,
                "processed_at": refund_obj.processed_at,
                "created_at": refund_obj.created_at,
            }

            # 관련 문의사항 조회
            inquiry = db.query(Inquiry).filter(Inquiry.inquiry_id == refund_obj.inquiry_id).first()
            if inquiry:
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


def create_manual_payment(db: Session, payment_data: dict) -> Payment:
    if not payment_data.get('subscription_id') and not payment_data.get('token_plan_id'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'subscription_id' or 'token_plan_id' must be provided."
        )

    payment = Payment(
        payment_id=uuid.uuid4(),
        user_id=payment_data['user_id'],
        payment_number=f'MAN{datetime.now().strftime("%Y%m%d%H%M%S")}',  # MAN + YYYYMMDDhhmmss 형식으로 변경
        payment_method='수동결제',
        manual_payment_reason=payment_data['manual_payment_reason'],
        payment_date=datetime.now(),
        status='SUCCESS',
        amount=0,
    )

    if payment_data.get('token_plan_id'):
        token_plan = db.query(TokenPlan).filter(
            TokenPlan.token_plan_id == payment_data['token_plan_id']
        ).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found.")

        payment.token_plan_id = token_plan.token_plan_id
        payment.amount = float(token_plan.discounted_price or token_plan.price)
        payment.tokens_purchased = token_plan.tokens

        # 스톤 지급 처리
        token = db.query(Token).filter(Token.user_id == payment_data['user_id']).first()
        if not token:
            token = Token(
                user_id=payment_data['user_id'],
                total_tokens=token_plan.tokens,
                used_tokens=0,
                last_charged_at=datetime.now(),
                expires_at=datetime.now() + timedelta(days=365),
            )
            db.add(token)
        else:
            token.total_tokens += token_plan.tokens
            token.last_charged_at = datetime.now()
            token.expires_at = datetime.now() + timedelta(days=365)

    elif payment_data.get('subscription_id'):
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == payment_data['subscription_id']
        ).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found.")

        # 기존 구독 확인
        existing_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == payment_data['user_id'],
            UserSubscription.status == 'ACTIVE'
        ).first()
        if existing_subscription:
            raise HTTPException(
                status_code=400,
                detail="User already has an active subscription."
            )

        # 새 구독 생성
        subscription = UserSubscription(
            user_id=payment_data['user_id'],
            plan_id=subscription_plan.plan_id,
            start_date=datetime.now().date(),
            next_billing_date=(datetime.now() + timedelta(days=30)).date(),
            status='ACTIVE',
            subscription_number=f"SUB{datetime.now().strftime('%Y%m%d%H%M%S')}",
            subscriptions_method='수동결제'
        )
        db.add(subscription)
        db.flush()  # subscription_id를 얻기 위해 flush

        payment.subscription_id = subscription.subscription_id
        payment.amount = float(subscription_plan.discounted_price or subscription_plan.price)

        # 구독 시 제공되는 스톤이 있다면 처리
        if subscription_plan.tokens_included:
            payment.tokens_purchased = subscription_plan.tokens_included
            token = db.query(Token).filter(Token.user_id == payment_data['user_id']).first()
            if not token:
                token = Token(
                    user_id=payment_data['user_id'],
                    total_tokens=subscription_plan.tokens_included,
                    used_tokens=0,
                    last_charged_at=datetime.now(),
                    expires_at=datetime.now() + timedelta(days=365),
                )
                db.add(token)
            else:
                token.total_tokens += subscription_plan.tokens_included
                token.last_charged_at = datetime.now()
                token.expires_at = datetime.now() + timedelta(days=365)

    try:
        db.add(payment)
        db.commit()
        db.refresh(payment)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create manual payment")

    return payment

def get_admin_payments(
    db: Session,
    query: Optional[str],
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    payment_method: Optional[str],
    page: int,
    limit: int,
    sort: str,
    status: Optional[str] = None
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
                User.nickname.ilike(f"%{query}%"),
                Payment.payment_method.ilike(f"%{query}%"),
                Payment.manual_payment_reason.ilike(f"%{query}%"),
                Payment.payment_number.ilike(f"%{query}%")
            )
        )

    # 결제 수단 필터
    if payment_method:
        if payment_method == 'manual':
            query_builder = query_builder.filter(Payment.payment_method == 'manual')
        elif payment_method == 'kakaopay':
            query_builder = query_builder.filter(Payment.payment_method == "kakaopay")

    if status:
        query_builder = query_builder.filter(Payment.status == status)

    if start_date and end_date:
        query_builder = query_builder.filter(
            Payment.payment_date.between(start_date, end_date)
        )

    # 전체 개수를 먼저 구합니다
    total_count = query_builder.count()

    sort_column, sort_direction = sort.split(":")
    if sort_direction == "desc":
        query_builder = query_builder.order_by(getattr(Payment, sort_column).desc())
    else:
        query_builder = query_builder.order_by(getattr(Payment, sort_column))

    results = query_builder.offset((page - 1) * limit).limit(limit).all()

    payments = []
    for payment, user_nickname, refund in results:
        # product_name 구성 로직 추가
        product_name = None
        payment_number = payment.payment_number

        if payment.token_plan_id:
            token_plan = db.query(TokenPlan).get(payment.token_plan_id)
            if token_plan:
                product_name = f"{token_plan.tokens} 스톤"
        elif payment.subscription_id:
            subscription = db.query(UserSubscription).get(payment.subscription_id)
            if subscription and subscription.subscription_plan:
                product_name = subscription.subscription_plan.plan_name

        payments.append(
            payment_schemas.PaymentListResponse(
                payment_id=payment.payment_id,
                user_nickname=user_nickname,
                product_name=product_name,
                payment_number=payment_number,
                amount=payment.amount,
                payment_method=payment.payment_method,
                status=payment.status,
                payment_date=payment.payment_date,
                refund=payment_schemas.RefundResponse.from_orm(refund) if refund else None
            )
        )

    # 헤더에 전체 개수를 포함하여 반환
    return payments, total_count

# 쿠폰 사용 관련 서비스 코드
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

class PaymentService:
    def set_cache(self, db: Session, tid: str, user_id: UUID, cid: str, partner_order_id: str, partner_user_id: str, subscription_id: int, environment: str, data: dict):
        try:
            db.query(PaymentCache).filter(PaymentCache.tid == tid).delete()
            new_cache = PaymentCache(
                user_id=user_id,
                tid=tid,
                cid=cid,
                partner_order_id=partner_order_id,
                partner_user_id=partner_user_id,
                subscription_id=subscription_id,
                environment=environment,
                data=data,
            )
            db.add(new_cache)
            db.commit()
            db.refresh(new_cache)
            return new_cache
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Failed to set cache: {str(e)}")

    def get_cache(self, db: Session, order_id: str):
        try:
            cache = db.query(PaymentCache).filter(PaymentCache.partner_order_id == order_id).order_by(PaymentCache.created_at.desc()).first()
            if not cache:
                raise HTTPException(status_code=404, detail="Cache not found")
            return cache
        except Exception as e:
            raise RuntimeError(f"Failed to get cache: {str(e)}")

    def delete_cache(self, db: Session, user_id: UUID):
        try:
            deleted_count = db.query(PaymentCache).filter(PaymentCache.user_id == user_id).delete()
            db.commit()
            if deleted_count == 0:
                raise HTTPException(status_code=404, detail="Cache not found")
            return {"message": "Cache deleted successfully"}
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Failed to delete cache: {str(e)}")

    def initiate_payment(self, payment_request: payment_schemas.KakaoPayRequest, db: Session, current_user: User):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }

        token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == payment_request.plan_id).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")

        discount_amount = Decimal(0)
        coupon = None
        if payment_request.coupon_code:
            coupon = get_coupon_by_code(db, payment_request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="Invalid coupon code")

            if coupon.discount_type == 'AMOUNT':
                discount_amount = Decimal(coupon.discount_value)
            elif coupon.discount_type == 'RATE':
                discount_amount = Decimal(token_plan.price) * Decimal(coupon.discount_value / 100)

            if coupon.used_count >= (coupon.max_usage or 0):
                raise HTTPException(status_code=400, detail="Coupon usage limit exceeded")
            if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
                raise HTTPException(status_code=400, detail="Coupon is not valid at this time")

        total_amount = max(Decimal(token_plan.price) - discount_amount, Decimal(0)) * payment_request.quantity
        partner_order_id = str(uuid.uuid4())

        data = {
            "cid": settings.KAKAO_PAY_CID_ONE,
            "partner_order_id": partner_order_id,
            "partner_user_id": str(current_user.user_id),
            "item_name": f"{token_plan.tokens} tokens",
            "quantity": payment_request.quantity,
            "total_amount": float(total_amount),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": f"{settings.KAKAO_PAY_SUCCESS}?partner_order_id={partner_order_id}",
            "cancel_url": settings.KAKAO_PAY_CANCEL,
            "fail_url": f"{settings.KAKAO_PAY_FAIL}?reason=failure&partner_order_id={partner_order_id}",
        }

        try:
            response = requests.post(f"{settings.KAKAO_PAY_BASE_URL}/ready", headers=headers, json=data)
            response_data = response.json()

            if response.status_code != 200:
                logger.error(f"Payment initiation failed: {response_data.get('msg')}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

            tid = response_data.get("tid")

            payment = Payment(
                payment_id=partner_order_id,
                user_id=current_user.user_id,
                token_plan_id=token_plan.token_plan_id,
                payment_number=tid,
                tokens_purchased=token_plan.tokens * payment_request.quantity,
                amount=float(total_amount),
                payment_method="카카오페이_단건결제",
                payment_date=datetime.now(),
                used_coupon_id=coupon.coupon_id if coupon else None,
                status="FAILED"
            )
            db.add(payment)
            db.commit()

            self.set_cache(
                db=db,
                tid=tid,
                user_id=current_user.user_id,
                cid=settings.KAKAO_PAY_CID_ONE,
                partner_order_id=partner_order_id,
                partner_user_id=str(current_user.user_id),
                subscription_id=None,
                environment=payment_request.environment,
                data={"environment": payment_request.environment}
            )

            redirect_url_key = {
                "pc": "next_redirect_pc_url",
                "mobile": "next_redirect_mobile_url",
                "app": "next_redirect_app_url"
            }.get(payment_request.environment)
            if not redirect_url_key:
                raise HTTPException(status_code=400, detail="Invalid environment specified")

            return {"redirect_url": response_data.get(redirect_url_key)}

        except IntegrityError as e:
            db.rollback()
            logger.error(f"Database IntegrityError: {str(e)}")
            raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
        except Exception as e:
            db.rollback()
            logger.error(f"Unexpected error during payment initiation: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred")
        
    def approve_payment(self, pg_token: str, db: Session, order_id: str):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        payment_info = self.get_cache(db, order_id)
        if not payment_info:
            logger.error(f"Failed to retrieve payment information from cache for order_id: {order_id}.")
            raise HTTPException(status_code=400, detail="Payment information not found in cache.")

        try:
            data = {
                "cid": payment_info.cid,
                "tid": payment_info.tid,
                "partner_order_id": payment_info.partner_order_id,
                "partner_user_id": payment_info.partner_user_id,
                "pg_token": pg_token,
            }

            response = requests.post(f"{settings.KAKAO_PAY_BASE_URL}/approve", headers=headers, json=data)
            response_data = response.json()

            if response.status_code != 200 or not response_data.get("aid"):
                logger.error(f"Payment approval failed with response: {response_data}")
                raise HTTPException(status_code=400, detail=response_data.get("msg", "Payment approval failed"))

            payment = db.query(Payment).filter(Payment.payment_number == payment_info.tid).first()
            if not payment:
                logger.error(f"Payment not found for tid: {payment_info.tid}")
                raise HTTPException(status_code=404, detail="Payment not found")

            payment.status = "SUCCESS"
            payment.transaction_number = response_data.get("aid")
            payment.payment_date = response_data.get("approved_at")
            db.commit()

            if payment_info.cid == settings.KAKAO_PAY_CID_SUB:
                self._process_subscription(payment, response_data, db)

            self._process_tokens(payment, db)

            logger.info(f"Payment approved successfully for user_id: {payment.user_id}")
            return payment_schemas.KakaoPayApproval(**response_data)

        except Exception as e:
            logger.error(f"Exception occurred during payment approval process: {str(e)}")
            raise HTTPException(status_code=500, detail="An error occurred while processing the payment approval.")

    def _process_subscription(self, payment: Payment, response_data: dict, db: Session):
        user_subscription = db.query(UserSubscription).filter(
            UserSubscription.subscription_id == payment.subscription_id
        ).first()

        if not user_subscription:
            logger.error(f"Subscription not found for subscription_id: {payment.subscription_id}")
            raise HTTPException(status_code=404, detail="Subscription not found")

        user_subscription.subscription_number = response_data.get("sid")
        user_subscription.status = "ACTIVE"
        db.commit()
        logger.info(f"Subscription updated for user_id: {payment.user_id}")

    def _process_tokens(self, payment: Payment, db: Session):
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

    def fail_payment(self, response_data: dict, db: Session, order_id: str):
        try:
            payment_info = self.get_cache(db, order_id)
            if not payment_info:
                logger.warning("Cache not found. Attempting to retrieve payment information from the database.")

                payment_number = response_data.get("tid")
                if not payment_number:
                    logger.error("Payment TID not provided in the response data.")
                    raise HTTPException(status_code=400, detail="Payment TID not found in response data.")

                payment = db.query(Payment).filter(Payment.payment_number == payment_number).first()
                if not payment:
                    logger.error(f"Payment not found for tid: {payment_number}")
                    raise HTTPException(status_code=404, detail="Payment not found.")
            else:
                payment = db.query(Payment).filter(Payment.payment_number == payment_info.tid).first()
                if not payment:
                    logger.error(f"Payment not found for tid: {payment_info.tid}")
                    raise HTTPException(status_code=404, detail="Payment not found.")

            payment.status = "FAILED"
            db.commit()
            db.refresh(payment)

            logger.info(f"Payment marked as FAILED for user_id: {payment.user_id}, reason: {response_data.get('error_message')}")
            return {
                "status": "FAILED",
                "reason": response_data.get("error_message", "No error message provided"),
                "details": response_data.get("extras", {}),
                "payment_id": payment.payment_id
            }

        except HTTPException as e:
            logger.error(f"HTTPException during payment failure processing: {e.detail}")
            raise e

        except Exception as e:
            logger.error(f"Exception occurred during payment failure processing: {str(e)}")
            raise HTTPException(status_code=500, detail="An error occurred while processing the payment failure.")

    def initiate_subscription(self, subscription_request: payment_schemas.KakaoPaySubscriptionRequest, db: Session, current_user: User):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
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
                raise HTTPException(status_code=400, detail="Invalid coupon code")

            if coupon.discount_type == 'AMOUNT':
                discount_amount = Decimal(coupon.discount_value)
            elif coupon.discount_type == 'RATE':
                discount_amount = Decimal(subscription_plan.discounted_price) * Decimal(coupon.discount_value / 100)

            if coupon.used_count >= (coupon.max_usage or 0):
                raise HTTPException(status_code=400, detail="Coupon usage limit exceeded")
            if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
                raise HTTPException(status_code=400, detail="Coupon is not valid during this period")

        total_amount = max(Decimal(subscription_plan.discounted_price) - discount_amount, Decimal(0)) * subscription_request.quantity
        partner_order_id = str(uuid.uuid4())

        data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "partner_order_id": partner_order_id,
            "partner_user_id": str(current_user.user_id),
            "item_name": subscription_plan.plan_name,
            "quantity": 1,
            "total_amount": float(total_amount),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": f"{settings.KAKAO_PAY_SUCCESS}?partner_order_id={partner_order_id}",
            "cancel_url": settings.KAKAO_PAY_CANCEL,
            "fail_url": f"{settings.KAKAO_PAY_FAIL}?reason=failure&partner_order_id={partner_order_id}",
        }

        try:
            response = requests.post(f"{settings.KAKAO_PAY_BASE_URL}/ready", headers=headers, json=data)
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
                    subscriptions_method="KakaoPay",
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
                    payment_method="카카오페이_정기결제시작",
                    payment_date=datetime.now(),
                    used_coupon_id=coupon.coupon_id if coupon else None,
                    status="FAILED",
                )
                db.add(payment)
                db.commit()

                self.set_cache(
                    db=db,
                    tid=tid,
                    user_id=current_user.user_id,
                    cid=settings.KAKAO_PAY_CID_SUB,
                    partner_order_id=partner_order_id,
                    partner_user_id=str(current_user.user_id),
                    subscription_id=subscription.subscription_id,
                    environment=subscription_request.environment,
                    data={
                        "subscription_id": subscription.subscription_id,
                    },
                )

                redirect_url_key = {
                    "pc": "next_redirect_pc_url",
                    "mobile": "next_redirect_mobile_url",
                    "app": "next_redirect_app_url",
                }.get(subscription_request.environment)

                if not redirect_url_key:
                    raise HTTPException(status_code=400, detail="Invalid environment specified")

                return {"redirect_url": response_data.get(redirect_url_key)}

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

    @classmethod
    def process_subscription(cls, user_id: UUID, db: Session):
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "ACTIVE"
        ).first()

        if not subscription:
            logger.error(f"Subscription not found or inactive for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="Active subscription not found")

        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == subscription.plan_id
        ).first()

        if not subscription_plan or not subscription_plan.price:
            logger.error(f"Invalid subscription plan for user_id: {user_id}, plan_id: {subscription.plan_id}")
            raise HTTPException(status_code=400, detail="Invalid subscription plan")

        data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "sid": subscription.subscription_number,
            "partner_order_id": f"subscription_order_{uuid.uuid4()}",
            "partner_user_id": str(user_id),
            "item_name": subscription_plan.plan_name,
            "quantity": 1,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
        }

        try:
            response = requests.post(f"{settings.KAKAO_PAY_BASE_URL}/subscription", json=data)
            response_data = response.json()

            if response.status_code == 200:
                logger.info(f"Subscription payment successful for user_id: {user_id}")

                payment = Payment(
                    payment_id=f"order_{uuid.uuid4()}",
                    user_id=user_id,
                    subscription_id=subscription.subscription_id,
                    payment_number=response_data.get("tid"),
                    amount=float(subscription_plan.price),
                    payment_method="카카오페이_정기결제",
                    payment_date=datetime.now(),
                    status="SUCCESS",
                    transaction_number=response_data.get("aid"),
                )
                db.add(payment)

                # 고정 주기 사용 (예: 30일)
                subscription.next_billing_date = subscription.next_billing_date + timedelta(days=30)
                db.commit()

                return {"status": "SUCCESS", "message": "Payment successful"}
            else:
                error_message = response_data.get("msg", "Unknown error")
                logger.error(f"Subscription payment failed for user_id: {user_id}, reason: {error_message}")
                raise HTTPException(status_code=400, detail=error_message)
        except Exception as e:
            logger.error(f"Exception occurred: {str(e)}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Subscription payment failed.")

    @classmethod
    def process_all_subscriptions(cls, db: Session):
        today = datetime.now().date()
        active_subscriptions = db.query(UserSubscription).filter(
            UserSubscription.next_billing_date == today,
            UserSubscription.status == "ACTIVE"
        ).all()

        if not active_subscriptions:
            logger.info("No active subscriptions to process today.")
            return {"message": "No subscriptions to process today."}

        logger.info(f"Processing {len(active_subscriptions)} subscriptions for today.")

        results = []
        for subscription in active_subscriptions:
            try:
                result = cls.process_subscription(subscription.user_id, db)
                results.append({"user_id": subscription.user_id, "result": result})
            except HTTPException as e:
                logger.error(f"Failed to process subscription for user_id: {subscription.user_id}, error: {str(e)}")
                results.append({"user_id": subscription.user_id, "error": str(e)})

        return {"message": "Subscription payments processed.", "results": results}

    def cancel_subscription(self, user_id: UUID, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }

        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'ACTIVE'
        ).first()

        if not subscription:
            logger.error(f"Subscription not found for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="No active subscription found for the given user.")

        data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "sid": subscription.subscription_number,
        }

        try:
            response = requests.post(
                f"{settings.KAKAO_PAY_BASE_URL}/manage/subscription/inactive",
                headers=headers,
                json=data
            )
            response_data = response.json()

            if response.status_code == 200:
                subscription.status = 'CANCELLED'
                db.commit()

                logger.info(f"Subscription successfully cancelled for user_id: {user_id}")
                return {
                    "status": "success",
                    "details": response_data
                }
            else:
                logger.error(f"KakaoPay subscription cancellation failed: {response_data.get('msg')}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))
        except requests.RequestException as e:
            logger.error(f"Failed to cancel subscription via KakaoPay API: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to connect to KakaoPay API.")
        except Exception as e:
            logger.error(f"Unexpected error during subscription cancellation: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred during subscription cancellation.")

    def get_subscription_status(self, user_id: UUID, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'ACTIVE'
        ).first()

        if not subscription:
            logger.error(f"Active subscription not found for user_id: {user_id}")
            raise HTTPException(status_code=404, detail="No active subscription found for the given user.")

        data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "sid": subscription.subscription_number,
        }

        try:
            response = requests.post(
                f"{settings.KAKAO_PAY_BASE_URL}/manage/subscription/status",
                headers=headers,
                json=data
            )
            response_data = response.json()

            if response.status_code == 200:
                logger.info(f"Successfully retrieved subscription status for SID: {subscription.subscription_number}")

                if response_data.get("status") != subscription.status:
                    logger.info(f"Syncing subscription status for user_id: {user_id}")
                    subscription.status = response_data.get("status")
                    db.commit()

                return response_data
            else:
                logger.error(f"KakaoPay subscription status check failed: {response_data.get('msg')}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except requests.RequestException as e:
            logger.error(f"Failed to connect to KakaoPay API: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to connect to KakaoPay API.")
        except Exception as e:
            logger.error(f"Unexpected error during subscription status check: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred during subscription status check.")

    def process_refund(refund_id: int, db: Session):
        refund = db.query(Refund).filter(Refund.refund_id == refund_id).first()
        if not refund or refund.status != "PENDING":
            raise HTTPException(status_code=400, detail="Refund not found or already processed.")

        payment = db.query(Payment).filter(Payment.payment_id == refund.payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found.")

        token = db.query(Token).filter(Token.user_id == payment.user_id).first()
        if not token or token.total_tokens < payment.tokens_purchased:
            raise HTTPException(status_code=400, detail="Insufficient tokens for refund.")

        if payment.payment_method == "카카오페이_단건결제":
            cid = settings.KAKAO_PAY_CID_ONE
        elif payment.payment_method == "카카오페이_정기결제시작":
            cid = settings.KAKAO_PAY_CID_SUB
        elif payment.payment_method == "카카오페이_정기결제":
            cid = settings.KAKAO_PAY_CID_SEQ
        else:
            raise HTTPException(status_code=400, detail="Invalid payment method for refund.")

        # 카카오 페이 환불 요청
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        data = {
            "cid": cid,
            "tid": payment.payment_number,
            "cancel_amount": refund.amount,
            "cancel_tax_free_amount": 0,  # 필요 시 수정
            "cancel_vat_amount": 0,      # 필요 시 수정
        }
        try:
            response = requests.post(f"{settings.KAKAO_PAY_BASE_URL}/cancel", headers=headers, json=data)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=500, detail=f"KakaoPay API request failed: {str(e)}")

        response_data = response.json()
        if response_data.get("status") not in ["CANCEL_PAYMENT", "PART_CANCEL_PAYMENT"]:
            raise HTTPException(status_code=400, detail=f"Refund failed: {response_data.get('error_message', 'Unknown error')}")

        token.total_tokens -= payment.tokens_purchased
        db.commit()

        refund.status = "APPROVED"
        refund.processed_at = datetime.now()
        refund.processed_by = None  # 나중에 관리자 토큰 연결시 관리자 user_id 입력

        # 결제 상태 환불로 변경
        payment.status = "REFUNDED"

        db.commit()
        db.refresh(refund)

        return refund

    def change_subscription_method(self, user_id: str, subscription_request, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {settings.KAKAO_PAY_SECRET_KEY}",
            "Content-Type": "application/json",
        }

        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "ACTIVE",
        ).first()

        if not subscription:
            raise HTTPException(status_code=404, detail="Active subscription not found.")

        deactivate_data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "sid": subscription.subscription_number,
        }

        deactivate_response = requests.post(
            f"{settings.KAKAO_PAY_BASE_URL}/manage/subscription/inactive",
            headers=headers,
            json=deactivate_data,
        )
        if deactivate_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to deactivate old subscription SID: {deactivate_response.json().get('msg')}",
            )

        partner_order_id = str(uuid.uuid4())
        data = {
            "cid": settings.KAKAO_PAY_CID_SUB,
            "partner_order_id": partner_order_id,
            "partner_user_id": user_id,
            "item_name": subscription_request.item_name,
            "quantity": 1,
            "total_amount": 0,
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": settings.KAKAO_PAY_SUCCESS,
            "cancel_url": settings.KAKAO_PAY_CANCEL,
            "fail_url": settings.KAKAO_PAY_FAIL,
        }

        try:
            response = requests.post(
                f"{settings.KAKAO_PAY_BASE_URL}/ready",
                headers=headers,
                json=data,
            )
            response_data = response.json()

            if response.status_code == 200:
                tid = response_data.get("tid")
                sid = response_data.get("sid") 
                if not sid:
                    raise HTTPException(status_code=400, detail="Failed to retrieve new SID.")

                subscription.subscription_number = sid
                subscription.next_billing_date = datetime.now().date()
                db.commit()

                payment = Payment(
                    payment_id=partner_order_id,
                    user_id=user_id,
                    subscription_id=subscription.subscription_id,
                    payment_number=tid,
                    amount=0,
                    payment_method="카카오페이_결제수단변경",
                    payment_date=datetime.now(),
                    status="SUCCESS",
                )
                db.add(payment)
                db.commit()

                redirect_url_key = {
                    "pc": "next_redirect_pc_url",
                    "mobile": "next_redirect_mobile_url",
                    "app": "next_redirect_app_url",
                }.get(subscription_request.environment)

                if not redirect_url_key:
                    raise HTTPException(status_code=400, detail="Invalid environment specified")

                return {"redirect_url": response_data.get(redirect_url_key)}

            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to initiate new subscription: {response_data.get('msg')}",
                )

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
