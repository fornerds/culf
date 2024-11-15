import logging
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from typing import Optional
from uuid import UUID
from datetime import date

class SubscriptionService:
    @staticmethod
    def get_user_subscription(db: Session, user_id: int):
        logging.info(f"Searching for subscription with user_id: {user_id}")
        subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).all()
        if not subscription:
            logging.info(f"No subscription found for user_id: {user_id}")
        return subscription

    @staticmethod
    def update_user_subscription(db: Session, user_id: UUID, plan_id: int) -> UserSubscription:
        # 구독 변경 껍데기 함수
        user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).all()
        if not user_subscription:
            raise HTTPException(status_code=404, detail="Subscription not found for this user")

        # 추후 결제 로직 추가
        user_subscription.plan_id = plan_id
        db.commit()
        db.refresh(user_subscription)
        return user_subscription

    @staticmethod
    def cancel_user_subscription(db: Session, user_id: UUID):
        # 구독 해지 껍데기 함수
        user_subscription = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).all()
        if not user_subscription:
            raise HTTPException(status_code=404, detail="Subscription not found for this user")

        # 추후 결제 로직 추가
        user_subscription.status = 'CANCELLED'
        db.commit()
