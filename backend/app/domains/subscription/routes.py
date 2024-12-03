from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.domains.subscription.schemas import (
    UserSubscriptionResponse, 
    UserSubscriptionUpdate
)
from app.domains.subscription.services import SubscriptionService
from app.domains.user import schemas as user_schemas
from app.domains.user.models import User

router = APIRouter()

# 구독 정보 조회
@router.get("/users/me/subscriptions", response_model=List[UserSubscriptionResponse])
def read_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user_id = current_user.user_id
    subscription_info = SubscriptionService.get_user_subscription(db, user_id)
    if not subscription_info:
        raise HTTPException(status_code=404, detail="Subscription information not found for this user")
    return subscription_info

# 구독 변경 (미구현 함수)
@router.put("/users/me/subscriptions", response_model=UserSubscriptionResponse)
def update_my_subscription(
    subscription_update: UserSubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    if not subscription_update.plan_id:
        raise HTTPException(status_code=400, detail="Plan ID must be provided for updating subscription")
    updated_subscription = SubscriptionService.update_user_subscription(db, current_user.user_id, subscription_update.plan_id)
    return updated_subscription

# 구독 해지 (미구현 함수)
@router.delete("/users/me/subscriptions", status_code=204)
def cancel_my_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    SubscriptionService.cancel_user_subscription(db, current_user.user_id)
