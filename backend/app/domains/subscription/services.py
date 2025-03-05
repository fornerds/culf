from datetime import date
import logging
from fastapi import HTTPException
from sqlalchemy.orm import Session
from . import models
from uuid import UUID


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
