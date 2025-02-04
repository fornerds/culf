from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas
from uuid import UUID
from . import models, schemas

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


def use_tokens(db: Session, user_id: UUID, tokens: int) -> None:
    """토큰 사용 처리 함수"""
    user_tokens = db.query(models.Token).filter(models.Token.user_id == user_id).first()
    current_date = datetime.now().date()

    if not user_tokens:
        raise HTTPException(
            status_code=404,
            detail="Token information not found for this user"
        )

    # 사용 가능한 토큰 계산
    available_subscription_tokens = (
        user_tokens.subscription_tokens
        if user_tokens.subscription_expires_at and user_tokens.subscription_expires_at >= current_date
        else 0
    )

    available_onetime_tokens = (
        user_tokens.onetime_tokens
        if user_tokens.onetime_expires_at and user_tokens.onetime_expires_at >= current_date
        else 0
    )

    # 만료된 토큰 정리
    if user_tokens.subscription_expires_at and user_tokens.subscription_expires_at < current_date:
        user_tokens.subscription_tokens = 0
        user_tokens.subscription_expires_at = None

    if user_tokens.onetime_expires_at and user_tokens.onetime_expires_at < current_date:
        user_tokens.onetime_tokens = 0
        user_tokens.onetime_expires_at = None

    # total_tokens 업데이트
    user_tokens.total_tokens = available_subscription_tokens + available_onetime_tokens

    if user_tokens.total_tokens < tokens:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "not_enough_tokens",
                "message": "스톤이 부족합니다. 스톤을 충전해주세요."
            }
        )

    try:
        # 정기결제 스톤 우선 사용
        subscription_tokens_to_use = min(tokens, available_subscription_tokens)
        if subscription_tokens_to_use > 0:
            user_tokens.subscription_tokens -= subscription_tokens_to_use
            # 사용 기록 추가
            usage_history = models.TokenUsageHistory(
                user_id=user_id,
                conversation_id=None,
                tokens_used=subscription_tokens_to_use,
                token_type='subscription',
                used_at=datetime.now()
            )
            db.add(usage_history)
            tokens -= subscription_tokens_to_use

        # 남은 토큰은 단건결제 스톤에서 사용
        if tokens > 0:
            user_tokens.onetime_tokens -= tokens
            usage_history = models.TokenUsageHistory(
                user_id=user_id,
                conversation_id=None,
                tokens_used=tokens,
                token_type='onetime',
                used_at=datetime.now()
            )
            db.add(usage_history)

        # 전체 토큰 수치 업데이트
        user_tokens.total_tokens -= (subscription_tokens_to_use + tokens)
        user_tokens.used_tokens += (subscription_tokens_to_use + tokens)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update token usage: {str(e)}"
        )