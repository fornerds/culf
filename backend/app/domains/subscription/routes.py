from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_user
from . import schemas, services
from app.domains.user import schemas as user_schemas
from app.domains.user import models as user_models

router = APIRouter()

# 구독 정보 조회
@router.get("/users/me/subscriptions", response_model=List[schemas.UserSubscriptionResponse])
def read_my_subscription(
    db: Session = Depends(get_db),
    current_user: user_models.User = Depends(get_current_active_user)
):
    user_id = current_user.user_id
    subscription_info = services.get_user_subscription(db, user_id)
    if not subscription_info:
        raise HTTPException(status_code=404, detail="Subscription information not found for this user")
    return subscription_info

@router.get("/users/me/subscribed", response_model=schemas.SubscriptionStatusResponse)
def read_my_subscription(
    db: Session = Depends(get_db),
    current_user: user_models.User = Depends(get_current_active_user)
):
    """
    현재 로그인된 유저가 '유효 구독' 상태인지 여부를 반환합니다.
    - is_subscribed: True/False
    """
    is_subscribed = services.is_user_subscribed(db, current_user.user_id)
    return schemas.SubscriptionStatusResponse(is_subscribed=is_subscribed)

# 구독 변경 (미구현 함수)
@router.put("/users/me/subscriptions", response_model=schemas.UserSubscriptionResponse)
def update_my_subscription(
    subscription_update: schemas.UserSubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    if not subscription_update.plan_id:
        raise HTTPException(status_code=400, detail="Plan ID must be provided for updating subscription")
    updated_subscription = services.update_user_subscription(db, current_user.user_id, subscription_update.plan_id)
    return updated_subscription

# 구독 해지 (미구현 함수)
@router.delete("/users/me/subscriptions", status_code=204)
def cancel_my_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    services.cancel_user_subscription(db, current_user.user_id)
