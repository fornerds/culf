from calendar import monthrange
from fastapi import HTTPException, status
from sqlalchemy import extract, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime, timedelta
from uuid import UUID
import uuid
import logging

from app.domains.inquiry import services as inquiry_services
from app.domains.payment import schemas as payment_schemas
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon
from app.domains.token.models import Token, TokenPlan 
from app.domains.user.models import User
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.domains.subscription import services as subscription_services
from app.domains.inquiry.models import Inquiry


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

def get_me_payments(db: Session, user_id: UUID, page: int = 1, limit: int = 10, year: int = None, month: int = None):
    offset = (page - 1) * limit
    query = db.query(Payment).filter(Payment.user_id == user_id)

    if year:
        query = query.filter(extract('year', Payment.payment_date) == year)
    if month:
        query = query.filter(extract('month', Payment.payment_date) == month)

    return query.offset(offset).limit(limit).all()

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

def create_refund(db: Session, payment: Payment, user_id : UUID, inquiry: Inquiry):
    """
    환불(Refund) 테이블에 데이터를 생성하고, 생성된 환불 객체를 반환합니다.
    """
    try:
        db_refund = Refund(
            payment_id=payment.payment_id,
            user_id=user_id,
            inquiry_id=inquiry.inquiry_id,
            amount=payment.amount,
            reason=inquiry.content,
            status="PENDING",
        )
        db.add(db_refund)
        db.commit()
        db.refresh(db_refund)
        return db_refund

    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create refund: {str(e)}")
    
def create_refund_inquiry_for_subscription(db: Session, user_id: UUID):
    """
    1) 구독 환불 가능 여부(check_refund_eligibility_for_subscription) 판별
    2) 환불 대상 Payment(최근 SUCCESS) 찾기
    3) Inquiry(문의) 정보 생성
    4) Refund 레코드 생성 (PENDING 상태)
    5) return (inquiry, refund)
    """

    # 1) 환불 가능 여부 체크 (실패 시 HTTPException 발생)
    subscription_services.check_refund_eligibility_for_subscription(db, user_id)

    subscription = (
        db.query(UserSubscription)
        .filter(UserSubscription.user_id == user_id)
        .filter(UserSubscription.end_date >= date.today())
        .first()
    )
    if not subscription:
        raise HTTPException(status_code=404, detail="환불할 구독이 없습니다.")

    last_payment = (
        db.query(Payment)
        .filter(Payment.subscription_id == subscription.subscription_id)
        .filter(Payment.status == 'SUCCESS')
        .order_by(Payment.payment_date.desc())
        .first()
    )
    if not last_payment:
        raise HTTPException(status_code=404, detail="환불 가능한 결제 내역이 없습니다.")

    # 3) 환불 문의 사항(Inquiry) 생성
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저 정보를 찾을 수 없습니다.")

    inquiry_data = {
        "title": "[자동 생성] 회원 탈퇴 환불 요청",
        "email": user.email,
        "contact": user.phone_number if user.phone_number else "",
        "content": "회원 탈퇴 과정에서 자동 생성된 환불 문의입니다.",
        "attachments": None
    }
    # Inquiry 생성
    inquiry = inquiry_services.create_inquiry(db, inquiry_data)

    # 4) Refund 레코드 생성 (상태 PENDING)
    refund = create_refund(db, last_payment, user_id, inquiry)

    return inquiry, refund

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
        current_date = datetime.now()

        if not token:
            token = Token(
                user_id=payment_data['user_id'],
                total_tokens=token_plan.tokens,
                used_tokens=0,
                tokens_expires_at=current_date + timedelta(days=365*5),  # 5년 만료
                last_charged_at=current_date
            )
            db.add(token)
        else:
            token.total_tokens += token_plan.tokens
            token.tokens_expires_at = current_date + timedelta(days=365*5)
            token.last_charged_at = current_date

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

        current_date = datetime.now()

        day_of_payment = current_date.day
        if current_date.month < 12:
            next_month = current_date.month + 1
            next_year = current_date.year
        else:
            next_month = 1
            next_year = current_date.year + 1

        _, last_day_of_next_month = monthrange(next_year, next_month)
        next_billing_day = min(day_of_payment, last_day_of_next_month)

        next_billing_date = current_date.replace(
            year=next_year,
            month=next_month,
            day=next_billing_day
        )
        end_date = next_billing_date - timedelta(days=1)

        # 새 구독 생성
        subscription = UserSubscription(
            user_id=payment_data['user_id'],
            plan_id=subscription_plan.plan_id,
            start_date=current_date.date(),
            end_date=end_date.date(),
            next_billing_date=next_billing_date.date(),
            status='CANCELLED',
            subscription_number=None,
            subscriptions_method='수동결제'
        )
        db.add(subscription)
        db.flush()  # subscription_id를 얻기 위해 flush

        payment.subscription_id = subscription.subscription_id
        payment.amount = float(subscription_plan.discounted_price or subscription_plan.price)

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
) -> List[payment_schemas.AdminPaymentListResponse]:
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
            payment_schemas.AdminPaymentListResponse(
                payment_id=payment.payment_id,
                user_nickname=user_nickname,
                product_name=product_name,
                amount=payment.amount,
                payment_method=payment.payment_method,
                status=payment.status,
                payment_date=payment.payment_date,
                refund=payment_schemas.RefundResponse.from_orm(refund) if refund else None
            )
        )

    # 헤더에 전체 개수를 포함하여 반환
    return payments, total_count

def get_admin_payment_detail(db: Session, payment_id: UUID):
    """
    결제 상세 조회 서비스
    - 결제 내역, 환불 내역, 문의 내역 포함
    """
    # 결제 정보 조회 (환불 정보 및 사용자 정보 포함)
    payment = (
        db.query(Payment)
        .filter(Payment.payment_id == payment_id)
        .options(
            joinedload(Payment.refunds),  # 환불 정보 로드
            joinedload(Payment.user),    # 사용자 정보 로드
        )
        .first()
    )

    if not payment:
        return None

    # 환불 정보 처리
    refund = None
    inquiries = []
    if payment.refunds:  # 환불 내역이 존재하면 첫 번째 항목 사용
        refund_obj = payment.refunds[0]
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

            # 환불과 관련된 문의사항 조회
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

    # 결제 상세 정보 반환
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
