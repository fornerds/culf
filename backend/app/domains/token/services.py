from datetime import datetime, date

from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, schemas
from app.domains.subscription import services as subscription_services
from app.domains.subscription import models as subscriprion_models
from uuid import UUID

def get_all_token_plans(db: Session) -> List[models.TokenPlan]:
    return db.query(models.TokenPlan).all()

def get_token_plan(db: Session, token_plan_id: int) -> models.TokenPlan:
    return db.query(models.TokenPlan).filter(models.TokenPlan.token_plan_id == token_plan_id).first()

def create_token_plan(db: Session, token_plan: schemas.TokenPlanCreate) -> models.TokenPlan:
    db_token_plan = models.TokenPlan(**token_plan.dict())
    db.add(db_token_plan)
    db.commit()
    db.refresh(db_token_plan)
    return db_token_plan

def update_token_plan(db: Session, token_plan_id: int, token_plan: schemas.TokenPlanUpdate) -> models.TokenPlan:
    db_token_plan = db.query(models.TokenPlan).filter(models.TokenPlan.token_plan_id == token_plan_id).first()
    if not db_token_plan:
        raise HTTPException(status_code=404, detail="Token plan not found")
    
    for field, value in token_plan.dict(exclude_unset=True).items():
        setattr(db_token_plan, field, value)
    
    db.commit()
    db.refresh(db_token_plan)
    return db_token_plan

def delete_t2oken_plan(db: Session, token_plan_id: int):
    db_token_plan = db.query(models.TokenPlan).filter(models.TokenPlan.token_plan_id == token_plan_id).first()
    if not db_token_plan:
        raise HTTPException(status_code=404, detail="Token plan not found")
    
    db.delete(db_token_plan)
    db.commit()

def get_user_tokens(db: Session, user_id: UUID) -> schemas.TokenInfo:
    token = db.query(models.Token).filter(models.Token.user_id == user_id).first()
    if not token:
        return schemas.TokenInfo(total_tokens=0, used_tokens=0, last_charged_at=None)
    return schemas.TokenInfo(
        total_tokens=token.total_tokens,
        used_tokens=token.used_tokens,
        last_charged_at=token.last_charged_at
    )


def use_tokens(db: Session, user_id: UUID, tokens: int, conversation_id: Optional[UUID] = None) -> None:
    """토큰 사용 처리 함수"""

    is_subscribed = subscription_services.is_user_subscribed(db, user_id)

    if is_subscribed:
        subscription = (
            db.query(subscriprion_models.UserSubscription)
            .filter(subscriprion_models.UserSubscription.user_id == user_id)
            .filter(subscriprion_models.UserSubscription.end_date >= date.today())
            .first()
        )

        usage_history = models.TokenUsageHistory(
            user_id=user_id,
            conversation_id=conversation_id,
            subscription_id=subscription.subscription_id if subscription else None,
            tokens_used=tokens,
            used_at=datetime.now()
        )
        db.add(usage_history)
        db.commit()
        return

    user_tokens = db.query(models.Token).filter(models.Token.user_id == user_id).first()
    current_date = datetime.now().date()

    if not user_tokens:
        raise HTTPException(
            status_code=404,
            detail="Token information not found for this user"
        )

    # 만료된 토큰 정리
    if user_tokens.tokens_expires_at and user_tokens.tokens_expires_at < current_date:
        user_tokens.total_tokens = 0
        user_tokens.tokens_expires_at = None

    if user_tokens.total_tokens < tokens:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "not_enough_tokens",
                "message": "스톤이 부족합니다. 스톤을 충전해주세요."
            }
        )

    try:
        usage_history = models.TokenUsageHistory(
            user_id=user_id,
            conversation_id=conversation_id,
            subscription_id=None,
            tokens_used=tokens,
            used_at=datetime.now()
        )
        db.add(usage_history)

        # 전체 토큰 수치 업데이트
        user_tokens.total_tokens -= tokens
        user_tokens.used_tokens += tokens

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update token usage: {str(e)}"
        )