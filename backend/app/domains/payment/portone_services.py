from calendar import monthrange
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
import requests
import uuid
import logging

from app.domains.token.models import TokenPlan, Token
from app.domains.payment.models import Payment, Coupon, PaymentCache, UserCoupon, Refund
from app.domains.payment import services, schemas
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.core.config import settings

logger = logging.getLogger("app")

def initiate_one_time_payment(payment_request, db: Session, current_user):
    """단건 결제 요청"""
    token_plan = db.query(TokenPlan).filter(
        TokenPlan.token_plan_id == payment_request.plan_id
    ).first()
    if not token_plan:
        raise HTTPException(status_code=404, detail="스톤 플랜을 찾을 수 없습니다.")

    # 가격 계산
    base_price = float(token_plan.discounted_price or token_plan.price)
    discount_amount = 0
    coupon = None
    if payment_request.coupon_code:
        coupon = db.query(Coupon).filter(Coupon.coupon_code == payment_request.coupon_code).first()
        coupon_validation = services.validate_coupon(db, payment_request.coupon_code, current_user.user_id)
        if not coupon_validation["is_valid"]:
            raise HTTPException(status_code=400, detail=coupon_validation["message"])
        discount_amount = coupon_validation["discount_value"]
    final_price = max(base_price - discount_amount, 0)

    merchant_uid = str(uuid.uuid4())

    if payment_request.pg == "kakaopay":
        ChannelKey = settings.PORTONE_KAKAOPAY_KEYS
    elif payment_request.pg == "danal_tpay":
        ChannelKey =  settings.PORTONE_DANAL_TPAY_KEYS
    elif payment_request.pg == "danal":
        ChannelKey =  settings.PORTONE_DANAL_KEYS
    else:
        raise HTTPException(status_code=400, detail="지원되지 않는 PG 제공자입니다.")

    payment_data = {
        "channelKey": ChannelKey,
        "merchant_uid": merchant_uid,
        "name": f"{token_plan.tokens} tokens",
        "amount": final_price,
        "buyer_email": current_user.email,
        "buyer_name": current_user.nickname,
        "buyer_tel": current_user.phone_number,
        "notice_url": settings.PORTONE_WEPHOOK_URL,
    }

    # PG사별 추가 설정
    if payment_request.pg == "kakaopay":
        payment_data["m_redirect_url"] = settings.PORTONE_KAKAOPAY_M_REDIRECT_URL
        payment_method = "one_kakaopay"
    elif payment_request.pg == "danal_tpay":
        pay_method = payment_request.pay_method or "card"
        if pay_method not in {"card", "trans", "vbank"}:
            raise HTTPException(status_code=400, detail="다날 Tpay를 위한 유효하지 않은 결제 방식입니다.")
        payment_data["pay_method"] = pay_method
        payment_method = f"one_danal_tpay_{pay_method}"
        if pay_method == "vbank":
            payment_data["biz_num"] = settings.PORTONE_DANAL_BIZ_NUM
    elif payment_request.pg == "danal":
        payment_data["pay_method"] = "phone"
        payment_method = "one_danal_phone"
    else:
        raise HTTPException(status_code=400, detail="지원되지 않는 PG 제공자입니다.")

    # PaymentCache 생성
    payment_cache = PaymentCache(
        user_id=current_user.user_id,
        merchant_uid=merchant_uid,
        payment_method=payment_method,
        token_plan_id=token_plan.token_plan_id,
        coupon_id=coupon.coupon_id if coupon else None,
        created_at=datetime.now(),
        expires_at=datetime.now() + timedelta(hours=1),
    )
    db.add(payment_cache)
    db.commit()

    return {
        "merchant_uid": merchant_uid,
        "payment_data": payment_data,
    }

def initiate_subscription_payment(subscription_request, db: Session, current_user):
    """첫 구독 결제 요청"""
    # 기존 활성화된 구독 정보 확인
    existing_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.user_id,
        UserSubscription.status == "ACTIVE"
    ).first()
    if existing_subscription:
        raise HTTPException(
            status_code=400,
            detail="이미 활성화된 구독이 있습니다."
        )

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == subscription_request.plan_id
    ).first()
    if not subscription_plan:
        raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")

    base_price = float(subscription_plan.discounted_price or subscription_plan.price)

    discount_amount = 0
    coupon = None
    if subscription_request.coupon_code:
        coupon = db.query(Coupon).filter(Coupon.coupon_code == subscription_request.coupon_code).first()
        coupon_validation = services.validate_coupon(db, subscription_request.coupon_code, current_user.user_id)
        if not coupon_validation["is_valid"]:
            raise HTTPException(status_code=400, detail=coupon_validation["message"])
        discount_amount = coupon_validation["discount_value"]

    final_price = max(base_price - discount_amount, 0)

    # 고유 merchant_uid 및 customer_uid 생성
    merchant_uid = str(uuid.uuid4())
    customer_uid = f"{current_user.user_id}-customer"

    if subscription_request.pg == "kakaopay":
        ChannelKey = settings.PORTONE_KAKAOPAY_SUB_KEYS
    elif subscription_request.pg == "danal_tpay":
        ChannelKey =  settings.PORTONE_DANAL_TPAY_KEYS
    else:
        raise HTTPException(status_code=400, detail="지원되지 않는 PG 제공자입니다.")

    # 결제 데이터 기본 구성
    payment_data = {
        "channelKey": ChannelKey,
        "merchant_uid": merchant_uid,
        "customer_uid": customer_uid,
        "name": subscription_plan.plan_name,
        "amount": final_price,
        "buyer_email": current_user.email,
        "buyer_name": current_user.nickname,
        "buyer_tel": current_user.phone_number,
        "m_redirect_url": settings.PORTONE_KAKAOPAY_M_REDIRECT_URL,
        "notice_url": settings.PORTONE_WEPHOOK_URL,
    }

    # PG사별 추가 설정
    if subscription_request.pg == "danal_tpay":
        payment_data.update({
            "pay_method": "card",
            "period": {
                "from": "20250101",
                "to": "20260101"
            }
        })
        payment_method = f"subscription_danal_tpay"
        
    elif subscription_request.pg == "kakaopay":

        payment_data.update({
            "pay_method": "card"
        })
        payment_method = f"subscription_kakaopay"
    else:
        raise HTTPException(status_code=400, detail="지원되지 않는 PG 제공자입니다.")

    payment_cache = PaymentCache(
        user_id=current_user.user_id,
        merchant_uid=merchant_uid,
        payment_method=payment_method,
        subscription_plan_id=subscription_plan.plan_id,
        coupon_id=coupon.coupon_id if coupon else None,
        created_at=datetime.now(),
        expires_at=datetime.now() + timedelta(hours=1),
    )
    db.add(payment_cache)
    db.commit()

    return {
        "merchant_uid": merchant_uid,
        "payment_data": payment_data,
    }

def get_portone_token():
    """포트원 토큰 발급"""
    response = requests.post(
        f"{settings.PORTONE_API_URL}/users/getToken",
        json={"imp_key": settings.PORTONE_IMP_KEY, "imp_secret": settings.PORTONE_IMP_SECRET},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Portone 토큰을 가져오는 데 실패했습니다.")
    return response.json()["response"]["access_token"]

def get_portone_payment_info(imp_uid, token):
    """결제 상세 조회"""
    response = requests.get(
        f"{settings.PORTONE_API_URL}/payments/{imp_uid}",
        headers={"Authorization": f"Bearer {token}"},
    )
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="결제 정보를 가져오는 데 실패했습니다.")
    return response.json()["response"]

def process_tokens(payment, db):
    """토큰 처리"""
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
        logger.info(f"사용자 ID: {payment.user_id}에 대한 새로운 토큰 항목이 생성되었습니다.")
    else:
        token.total_tokens += payment.tokens_purchased
        token.last_charged_at = payment.payment_date
        token.expires_at = payment.payment_date + timedelta(days=365)
        logger.info(f"사용자 ID: {payment.user_id}에 대한 토큰 항목이 업데이트되었습니다.")

    db.commit()

def save_payment_data(payment_info, payment_cache, db):
    """검증된 결제 데이터를 저장"""
    if payment_cache.token_plan_id:
        token_plan = db.query(TokenPlan).filter(
            TokenPlan.token_plan_id == payment_cache.token_plan_id
        ).first()

        payment_record = Payment(
            payment_id=payment_cache.merchant_uid,
            user_id=payment_cache.user_id,
            token_plan_id=payment_cache.token_plan_id,
            payment_number=payment_info["imp_uid"],
            transaction_number=payment_info["pg_tid"],
            tokens_purchased=token_plan.tokens,
            amount=payment_info["amount"],
            payment_method=payment_cache.payment_method,
            used_coupon_id=payment_cache.coupon_id if payment_cache.coupon_id else None,
            payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
            status="SUCCESS",
        )
        db.add(payment_record)
        process_tokens(payment_record, db)

    elif payment_cache.subscription_plan_id:
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == payment_cache.subscription_plan_id
        ).first()

        payment_date = datetime.fromtimestamp(payment_info["paid_at"])
        day_of_payment = payment_date.day
        next_month = payment_date.month + 1 if payment_date.month < 12 else 1
        next_year = payment_date.year if payment_date.month < 12 else payment_date.year + 1
        _, last_day_of_next_month = monthrange(next_year, next_month)
        next_billing_day = min(day_of_payment, last_day_of_next_month)
        next_billing_date = payment_date.replace(year=next_year, month=next_month, day=next_billing_day)

        subscription = UserSubscription(
            user_id=payment_cache.user_id,
            plan_id=subscription_plan.plan_id,
            start_date=payment_date.date(),
            next_billing_date=next_billing_date.date(),
            status="ACTIVE",
            subscription_number=payment_info["customer_uid"],
            subscriptions_method=payment_cache.payment_method,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        payment_record = Payment(
            payment_id=payment_cache.merchant_uid,
            user_id=payment_cache.user_id,
            subscription_id=subscription.subscription_id,
            payment_number=payment_info["imp_uid"],
            transaction_number=payment_info["pg_tid"],
            tokens_purchased=subscription_plan.tokens_included if subscription_plan.tokens_included else None,
            amount=payment_info["amount"],
            payment_method=payment_cache.payment_method,
            used_coupon_id=payment_cache.coupon_id if payment_cache.coupon_id else None,
            payment_date=payment_date,
            status="SUCCESS",
        )
        db.add(payment_record)

    # 쿠폰 처리
    if payment_cache.coupon_id:
        coupon = db.query(Coupon).filter(
            Coupon.coupon_id == payment_cache.coupon_id
        ).first()
        if coupon:
            coupon.used_count += 1
            db.add(coupon)

        user_coupon = UserCoupon(
            user_id=payment_cache.user_id,
            coupon_id=payment_cache.coupon_id,
            used_at=datetime.now(),
        )
        db.add(user_coupon)

    db.delete(payment_cache)
    db.commit()

def validate_payment_info(payment_request, db):
    """결제 정보를 검증하고 관련 데이터를 반환"""
    token = get_portone_token()
    payment_info = get_portone_payment_info(payment_request.imp_uid, token)

    # 중복 결제 검증
    existing_payment = db.query(Payment).filter(
        Payment.payment_id == payment_request.merchant_uid
    ).first()
    if existing_payment:
        logging.info(f"Duplicate payment request detected for {payment_request.merchant_uid}. Skipping processing.")
        return {"status": "duplicate", "message": "이미 처리된 결제 요청입니다."}

    payment_cache = db.query(PaymentCache).filter(
        PaymentCache.merchant_uid == payment_request.merchant_uid
    ).first()
    if not payment_cache:
        raise HTTPException(status_code=404, detail="결제 캐시를 찾을 수 없습니다.")

    expected_amount = None
    if payment_cache.token_plan_id:
        token_plan = db.query(TokenPlan).filter(
            TokenPlan.token_plan_id == payment_cache.token_plan_id
        ).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="스톤 플랜을 찾을 수 없습니다.")
        expected_amount = float(token_plan.discounted_price or token_plan.price)

    elif payment_cache.subscription_plan_id:
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == payment_cache.subscription_plan_id
        ).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")
        expected_amount = float(subscription_plan.discounted_price or subscription_plan.price)

    if expected_amount is None:
        raise HTTPException(status_code=400, detail="유효하지 않은 결제 유형입니다.")

    # 쿠폰 정보가 있을 경우 할인 로직 적용
    if payment_cache.coupon_id:
        coupon = db.query(Coupon).filter(
            Coupon.coupon_id == payment_cache.coupon_id
        ).first()
        if not coupon:
            raise HTTPException(status_code=404, detail="쿠폰 정보를 찾을 수 없습니다.")

        # 할인 금액 계산
        if coupon.discount_type == 'RATE':
            discount_amount = expected_amount * coupon.discount_value
        elif coupon.discount_type == 'AMOUNT':
            discount_amount = coupon.discount_value
        else:
            discount_amount = 0 

        expected_amount = max(0, expected_amount - discount_amount)

    # 금액 검증
    if payment_info["amount"] != expected_amount:
        raise HTTPException(
            status_code=400,
            detail=f"결제 금액이 일치하지 않습니다. 예상 금액: {expected_amount}, 결제 금액: {payment_info['amount']}"
        )

    return payment_info, payment_cache


def verify_and_save_payment(payment_request, db):
    """결제 검증 및 저장"""
    payment_info, payment_cache = validate_payment_info(payment_request, db)
    save_payment_data(payment_info, payment_cache, db)
    return {"status": "success", "message": "결제 처리가 완료되었습니다."}

def issue_refund(inquiry_id: int, db: Session):
    access_token = get_portone_token()

    refund = db.query(Refund).filter(Refund.inquiry_id == inquiry_id).first()
    if not refund or refund.status != "PENDING":
        raise HTTPException(status_code=400, detail="환불 요청이 존재하지 않거나 이미 처리된 요청입니다.")

    payment = db.query(Payment).filter(Payment.payment_id == refund.payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="결제 내역을 찾을 수 없습니다.")

    token = db.query(Token).filter(Token.user_id == payment.user_id).first()
    if not token or token.total_tokens < payment.tokens_purchased:
        raise HTTPException(status_code=400, detail="환불에 필요한 스톤이 부족합니다.")
    
    # 포트원 REST API로 환불 요청
    refund_payload = {
        "imp_uid": payment.payment_number,
        "reason": refund.reason,
        "amount": 0,
        "checksum": refund.amount
    }

    # 가상계좌 환불 정보 추가 (필요한 경우)
    if payment.payment_method == "virtual_account":
        refund_payload.update({
            "refund_holder": refund.refund_holder,
            "refund_bank": refund.refund_bank,
            "refund_account": refund.refund_account
        })

    response = requests.post(
        url="https://api.iamport.kr/payments/cancel",
        headers={"Authorization": f"Bearer {access_token}"},
        json=refund_payload
    )

    if response.status_code != 200 or response.json().get("code") != 0:
        error_message = response.json().get("message", "알 수 없는 오류가 발생했습니다.")
        raise HTTPException(status_code=400, detail=f"환불 요청 실패: {error_message}")

    # 환불 처리 성공 시 데이터베이스 업데이트
    token.total_tokens -= payment.tokens_purchased
    refund.status = "APPROVED"
    refund.processed_at = datetime.now()
    refund.processed_by = None  # 관리자 정보 추가 예정
    db.commit()

    return {
        "status": "success",
        "data": response.json().get("response")
    }

def schedule_subscription_payment(subscription_id, db: Session):
    """
    정기 결제 예약 로직.
    """
    token = get_portone_token()

    subscription = db.query(UserSubscription).filter(
        UserSubscription.subscription_id == subscription_id
    ).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == subscription.plan_id
    ).first()
    if not subscription_plan:
        raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")

    next_billing_date = subscription.next_billing_date

    schedule_data = {
        "customer_uid": subscription.subscription_number,
        "schedules": [
            {
                "merchant_uid": f"sub_{uuid.uuid4()}",
                "schedule_at": int(next_billing_date.timestamp()),
                "amount": float(subscription_plan.discounted_price or subscription_plan.price),
                "name": subscription_plan.plan_name,
                "notice_url": settings.PORTONE_WEPHOOK_URL,
            }
        ],
    }

    try:
        response = requests.post(
            f"{settings.PORTONE_API_URL}/subscribe/payments/schedule",
            json=schedule_data,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"결제 예약 요청 중 오류가 발생했습니다: {str(e)}")

    logging.info(f"Next subscription payment scheduled. Subscription ID: {subscription.subscription_id}")
    return response.json()

def identify_payment_type(merchant_uid: str) -> str:
    """
    주문 ID(merchant_uid)를 기반으로 결제 유형을 식별합니다.
    - "sub_"로 시작하면 정기 결제.
    - "one_"로 시작하면 일회성 결제.
    """
    if merchant_uid.startswith("sub_"):
        return "subscription"
    elif merchant_uid.startswith("one_"):
        return "single"
    else:
        return "unknown"

def process_subscription_payment(payment_info, db: Session):
    """
    정기 결제 처리 로직. 중복 처리 방지 포함
    """
    existing_payment = db.query(Payment).filter(
        Payment.payment_number == payment_info["imp_uid"]
    ).first()

    if existing_payment:
        logging.info(f"Duplicate subscription payment detected. Imp_uid: {payment_info['imp_uid']}")
        return

    subscription = db.query(UserSubscription).filter(
        UserSubscription.subscription_number == payment_info["customer_uid"]
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다.")

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == subscription.plan_id
    ).first()

    if not subscription_plan:
        raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")

    payment_record = Payment(
        payment_id=payment_info["merchant_uid"],
        user_id=subscription.user_id,
        subscription_id=subscription.subscription_id,
        payment_number=payment_info["imp_uid"],
        transaction_number=payment_info["pg_tid"],
        tokens_purchased=subscription_plan.tokens_included,
        amount=payment_info["amount"],
        payment_method=payment_info["pay_method"],
        payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
        status="SUCCESS",
    )

    db.add(payment_record)
    db.commit()
    logging.info(f"Subscription payment processed and saved. Subscription ID: {subscription.subscription_id}")

    return subscription

def process_single_payment(payment_info, db: Session):
    """
    단건 결제 처리 로직. 중복 처리 방지 포함
    """
    existing_payment = db.query(Payment).filter(
        Payment.payment_number == payment_info["imp_uid"]
    ).first()

    if existing_payment:
        logging.info(f"Duplicate single payment detected. Imp_uid: {payment_info['imp_uid']}")
        return

    token_plan = db.query(TokenPlan).filter(
        TokenPlan.token_plan_id == payment_info["custom_data"]["token_plan_id"]
    ).first()

    if not token_plan:
        raise HTTPException(status_code=404, detail="스톤 플랜을 찾을 수 없습니다.")

    payment_record = Payment(
        payment_id=payment_info["merchant_uid"],
        user_id=payment_info["custom_data"]["user_id"],
        token_plan_id=token_plan.token_plan_id,
        payment_number=payment_info["imp_uid"],
        transaction_number=payment_info["pg_tid"],
        tokens_purchased=token_plan.tokens,
        amount=payment_info["amount"],
        payment_method=payment_info["pay_method"],
        payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
        status="SUCCESS",
    )

    db.add(payment_record)
    db.commit()
    logging.info(f"Single payment processed and saved. Merchant UID: {payment_info['merchant_uid']}")

def handle_failed_subscription_payment(payment_info, db: Session):
    """
    실패한 구독 결제 처리 로직
    """
    subscription = db.query(UserSubscription).filter(
        UserSubscription.subscription_number == payment_info["customer_uid"]
    ).first()

    if not subscription:
        logging.warning(f"Subscription not found for customer_uid: {payment_info['customer_uid']}")
        return

    # 구독 상태를 CANCELLED로 업데이트
    subscription.status = "CANCELLED"
    db.add(subscription)

    # 결제 실패 내역 저장
    failed_payment = Payment(
        payment_id=payment_info["merchant_uid"],
        user_id=subscription.user_id,
        subscription_id=subscription.subscription_id,
        payment_number=payment_info["imp_uid"],
        transaction_number=payment_info.get("pg_tid"),
        tokens_purchased=None,
        amount=payment_info["amount"],
        payment_method=payment_info["pay_method"],
        payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
        status="FAILED",
        manual_payment_reason="결제 실패로 인한 구독 취소",
    )
    db.add(failed_payment)

    db.commit()
    logging.info(f"Failed subscription payment processed and subscription cancelled. Subscription ID: {subscription.subscription_id}")

def change_subscription_plan(change_request: schemas.SubscriptionChangeRequest, db: Session):
    """
    사용자의 구독 플랜 변경
    """
    # 기존 구독 정보 조회
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == change_request.user_id,
        UserSubscription.status == "ACTIVE",
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="활성화된 구독을 찾을 수 없습니다.")

    # 새 구독 플랜 확인
    new_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == change_request.new_plan_id
    ).first()

    if not new_plan:
        raise HTTPException(status_code=404, detail="새 구독 플랜을 찾을 수 없습니다.")

    # 기존 구독 상태를 CANCELLED로 변경
    subscription.status = "CANCELLED"
    db.add(subscription)
    db.commit()

    # 새 구독 정보 생성
    new_subscription = UserSubscription(
        user_id=change_request.user_id,
        plan_id=new_plan.plan_id,
        start_date=datetime.now().date(),
        next_billing_date=(datetime.now() + timedelta(days=30)).date(),
        status="ACTIVE",
        subscription_number=subscription.subscription_number,  # 기존 빌링키 재사용
        subscriptions_method=subscription.subscriptions_method,
    )
    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    logging.info(f"Subscription plan changed. New subscription ID: {new_subscription.subscription_id}")

    return new_subscription

def initiate_change_payment_method(change_request, db: Session, current_user):
    """
    구독 결제 방식 변경 요청 초기화
    """
    active_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.user_id,
        UserSubscription.status == "ACTIVE"
    ).first()

    if not active_subscription:
        raise HTTPException(
            status_code=404,
            detail="현재 활성화된 구독이 없습니다. 새로운 구독을 생성하세요."
        )

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == active_subscription.plan_id,
    ).first()

    if not subscription_plan:
        raise HTTPException(status_code=404, detail="구독 플랜 정보를 찾을 수 없습니다.")

    merchant_uid = str(uuid.uuid4())
    customer_uid = f"{current_user.user_id}-customer"

    payment_data = {
        "channelKey": settings.PORTONE_KAKAOPAY_SUB_KEYS
        if change_request.pg == "kakaopay"
        else settings.PORTONE_DANAL_TPAY_KEYS,
        "merchant_uid": merchant_uid,
        "customer_uid": customer_uid,
        "name": f"{subscription_plan.plan_name} 결제 방식 변경",
        "amount": 0,
        "buyer_email": current_user.email,
        "buyer_name": current_user.nickname,
        "buyer_tel": current_user.phone_number,
        "m_redirect_url": settings.PORTONE_KAKAOPAY_M_REDIRECT_URL,
        "notice_url": settings.PORTONE_WEPHOOK_URL,
    }

    payment_cache = PaymentCache(
        user_id=current_user.user_id,
        merchant_uid=merchant_uid,
        payment_method="change_payment_method",
        subscription_plan_id=subscription_plan.plan_id,
        created_at=datetime.now(),
        expires_at=datetime.now() + timedelta(hours=1),
    )
    db.add(payment_cache)
    db.commit()

    logging.info(f"Initialized payment method change for user_id: {current_user.user_id}, merchant_uid: {merchant_uid}")
    return payment_data


