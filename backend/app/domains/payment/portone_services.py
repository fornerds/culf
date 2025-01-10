from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime, timedelta
import requests
import uuid
import logging

from app.domains.token.models import TokenPlan, Token
from app.domains.payment.models import Payment, Coupon, PaymentCache, UserCoupon, Refund
from app.domains.payment import services as payment_service
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.core.config import settings

logger = logging.getLogger("app")

def initiate_one_time_payment(payment_request, db: Session, current_user):
    """단건 결제 요청"""
    token_plan = db.query(TokenPlan).filter(
        TokenPlan.token_plan_id == payment_request.plan_id
    ).first()
    if not token_plan:
        raise HTTPException(status_code=404, detail="토큰 플랜을 찾을 수 없습니다.")

    # 가격 계산
    base_price = float(token_plan.discounted_price or token_plan.price)
    discount_amount = 0
    coupon = None
    if payment_request.coupon_code:
        coupon = db.query(Coupon).filter(Coupon.coupon_code == payment_request.coupon_code).first()
        coupon_validation = payment_service.validate_coupon(db, payment_request.coupon_code, current_user.user_id)
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
        coupon_validation = payment_service.validate_coupon(db, subscription_request.coupon_code, current_user.user_id)
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
    """결제 상태 조회"""
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

def verify_and_save_payment(payment_request, db):
    """결제 검증 및 저장"""
    token = get_portone_token()
    payment_info = get_portone_payment_info(payment_request.imp_uid, token)

    payment_cache = db.query(PaymentCache).filter(
        PaymentCache.merchant_uid == payment_request.merchant_uid
    ).first()
    if not payment_cache:
        raise HTTPException(status_code=404, detail="결제 캐시를 찾을 수 없습니다.")

    if payment_cache.token_plan_id:
        # 단건 결제 로직
        tokens_purchased = db.query(TokenPlan).filter(
            TokenPlan.token_plan_id == payment_cache.token_plan_id
        ).first()
        if not tokens_purchased:
            raise HTTPException(status_code=404, detail="토큰 플랜을 찾을 수 없습니다.")

        payment_record = Payment(
            payment_id=payment_request.merchant_uid,
            user_id=payment_cache.user_id,
            token_plan_id=payment_cache.token_plan_id,
            payment_number=payment_info["imp_uid"],
            transaction_number=payment_info["pg_tid"],
            tokens_purchased=tokens_purchased.tokens,
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
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")

        subscription = UserSubscription(
            user_id=payment_cache.user_id,
            plan_id=subscription_plan.plan_id,
            start_date=datetime.now().date(),
            next_billing_date=(datetime.fromtimestamp(payment_info["paid_at"]) + timedelta(days=30)).date(),
            status="ACTIVE",
            subscription_number=payment_info["customer_uid"],
            subscriptions_method=payment_cache.payment_method,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        # Payment 기록 생성
        payment_record = Payment(
            payment_id=payment_request.merchant_uid,
            user_id=payment_cache.user_id,
            subscription_id=subscription.subscription_id,
            payment_number=payment_info["imp_uid"],
            transaction_number=payment_info["pg_tid"],
            tokens_purchased=subscription_plan.tokens_included if subscription_plan.tokens_included else None,
            amount=payment_info["amount"],
            payment_method=payment_cache.payment_method,
            used_coupon_id=payment_cache.coupon_id if payment_cache.coupon_id else None,
            payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
            status="SUCCESS",
        )
        db.add(payment_record)

    else:
        raise HTTPException(status_code=400, detail="유효하지 않은 결제 유형입니다.")

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
        raise HTTPException(status_code=400, detail="환불에 필요한 토큰이 부족합니다.")

    # 포트원 REST API로 환불 요청
    response = requests.post(
        url="https://api.iamport.kr/payments/cancel",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "imp_uid": payment.payment_number,
            "reason": refund.reason,
            "amount": 0,
            "checksum": payment.amount
        }
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

    return {"status": "success", "data": response.json().get("response")}

def schedule_subscription_payment(subscription_id, db):
    """반복 결제 예약"""
    token = get_portone_token()
    user_subscription = db.query(UserSubscription).filter(
        UserSubscription.subscription_id == subscription_id
    ).first()
    if not user_subscription:
        raise HTTPException(status_code=404, detail="구독 정보을 찾을 수 없습니다.")

    subscription_plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.plan_id == user_subscription.plan_id
    ).first()
    if not subscription_plan:
        raise HTTPException(status_code=404, detail="구독 플랜을 찾을 수 없습니다.")

    if not isinstance(user_subscription.next_billing_date, datetime):
        raise HTTPException(status_code=400, detail="구독 정보의 청구 날짜가 올바르지 않습니다.")

    schedule_data = {
        "customer_uid": user_subscription.subscription_number or f"{user_subscription.user_id}-customer",
        "schedules": [
            {
                "merchant_uid": str(uuid.uuid4()),
                "schedule_at": int(user_subscription.next_billing_date.timestamp()),
                "amount": float(subscription_plan.discounted_price or subscription_plan.price),
                "name": subscription_plan.plan_name,
            }
        ],
    }
    try:
        # API 호출
        response = requests.post(
            f"{settings.PORTONE_API_URL}/subscribe/payments/schedule",
            json=schedule_data,
            headers={"Authorization": f"Bearer {token}"},
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"결제 예약 요청 중 네트워크 오류가 발생했습니다: {str(e)}")
    
    # API 응답 처리
    if not response.ok:
        error_message = response.json().get("message", "알 수 없는 오류로 인해 결제 예약에 실패했습니다.") \
            if response.headers.get("Content-Type") == "application/json" else "포트원 API 응답이 올바르지 않습니다."
        raise HTTPException(status_code=400, detail=f"구독 결제 예약 실패: {error_message}")

    logger.info(f"Scheduling payment for subscription ID {subscription_id} with data: {schedule_data}")
    logger.info(f"Portone API response: {response.json()}")

    return response.json()

def identify_payment_type(merchant_uid: str) -> str:
    """
    주문 ID(merchant_uid)를 기반으로 결제 유형을 식별합니다.
    예를 들어, 구독 결제는 'sub_'로 시작하고, 일회성 결제는 'one_'로 시작.
    """
    if merchant_uid.startswith("sub_"):
        return "subscription"
    elif merchant_uid.startswith("one_"):
        return "single"
    else:
        return "unknown"

def process_subscription_payment(payment_info, db: Session):
    """
    정기 결제 처리 및 다음 결제 예약
    """
    if payment_info["status"] != "paid":
        raise Exception("정기 결제가 실패했습니다.")

    # DB에 결제 기록 저장
    # ...

    # 다음 결제 예약
    next_schedule_date = datetime.now() + timedelta(days=30)
    # schedule_next_payment(
    #     customer_uid=payment_info["customer_uid"],
    #     amount=payment_info["amount"],
    #     name="월간 이용권 정기결제",
    #     schedule_date=next_schedule_date,
    #     db=db,
    # )

def process_single_payment(payment_info, db: Session):
    """
    일회성 결제 처리
    """
    if payment_info["status"] != "paid":
        raise Exception("일회성 결제가 실패했습니다.")

    # DB에 결제 기록 저장
    # ...
