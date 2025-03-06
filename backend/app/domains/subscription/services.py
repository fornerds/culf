from datetime import datetime, timedelta, date
import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from . import models
from app.domains.token import models as token_models
from app.domains.payment import models as payment_models
from uuid import UUID
from typing import Tuple

def get_user_subscription(db: Session, user_id: UUID):
    logging.info(f"Searching for subscriptions with user_id: {user_id}")
    subscriptions = db.query(models.UserSubscription).filter(models.UserSubscription.user_id == user_id).all()
    if not subscriptions:
        logging.info(f"No subscriptions found for user_id: {user_id}")
    return subscriptions

def update_user_subscription(db: Session, user_id: UUID, plan_id: int) -> models.UserSubscription:
    # 구독 변경 껍데기 함수
    user_subscription = db.query(models.UserSubscription).filter(models.UserSubscription.user_id == user_id).all()
    if not user_subscription:
        raise HTTPException(status_code=404, detail="Subscription not found for this user")

    # 추후 결제 로직 추가
    user_subscription.plan_id = plan_id
    db.commit()
    db.refresh(user_subscription)
    return user_subscription

def cancel_user_subscription(db: Session, user_id: UUID):
    # 구독 해지 껍데기 함수
    user_subscription = db.query(models.UserSubscription).filter(models.UserSubscription.user_id == user_id).all()
    if not user_subscription:
        raise HTTPException(status_code=404, detail="Subscription not found for this user")

    # 추후 결제 로직 추가
    user_subscription.status = 'CANCELLED'
    db.commit()

def is_user_subscribed(db: Session, user_id) -> bool:
    """
    사용자가 현재 구독(무제한) 중인지 여부를 반환합니다.
    - end_date가 오늘 이후(>= today)이면 구독 중으로 간주
    """
    today = date.today()

    # end_date가 오늘 이후인 구독 레코드를 찾음
    subscription = (
        db.query(models.UserSubscription)
        .filter(models.UserSubscription.user_id == user_id)
        .filter(models.UserSubscription.end_date >= today)
        .first()
    )

    return subscription is not None

def check_refund_eligibility_for_subscription(db: Session, user_id) -> bool:
    """
    1) 사용자가 현재 구독 중인지 확인 (end_date >= today)
    2) 구독 결제일이 7일 이내인지 확인
    3) 구독 토큰(무제한 스톤) 사용 이력이 없는지 확인
    모두 만족하면 True, 아니면 False 반환
    """
    # 1) 사용자가 구독 중인지 확인
    is_subscribed = is_user_subscribed(db, user_id)
    if not is_subscribed:
        raise HTTPException(404, detail="구독 중이 아닙니다")

    # 2) 유효한 구독 레코드 가져오기 (현재 유저가 실제로 사용하는 ACTIVE 구독)
    subscription = (
        db.query(models.UserSubscription)
        .filter(models.UserSubscription.user_id == user_id)
        .filter(models.UserSubscription.end_date >= date.today())
        .first()
    )
    if not subscription:
        raise HTTPException(404, detail="구독 정보가 없습니다")

    # 해당 구독에 연결된 결제 내역 중 최근(또는 최초) 결제를 가져오기
    last_payment = (
        db.query(payment_models.Payment)
        .filter(payment_models.Payment.subscription_id == subscription.subscription_id)
        .filter(payment_models.Payment.status == 'SUCCESS')
        .order_by(payment_models.Payment.payment_date.desc())
        .first()
    )

    if not last_payment:
        raise HTTPException(404, detail="구독 결제 내역을 찾을 수 없습니다")

    # 3) 결제 후 7일 이내인지 확인
    seven_days_after_payment = last_payment.payment_date + timedelta(days=7)
    if datetime.now() > seven_days_after_payment:
        raise HTTPException(404, detail="결제 일로부터 7일 이상 지났습니다")

    # 4) 해당 구독이 연결된 무제한 스톤 사용 이력이 있는지 확인
    usage_count = (
        db.query(token_models.TokenUsageHistory)
        .filter(token_models.TokenUsageHistory.user_id == user_id)
        .filter(token_models.TokenUsageHistory.subscription_id == subscription.subscription_id)
        .filter(token_models.TokenUsageHistory.used_at >= last_payment.payment_date)
        .count()
    )
    if usage_count > 0:
        raise HTTPException(404, detail="마스터 스톤 사용 이력이 있습니다")

    return True