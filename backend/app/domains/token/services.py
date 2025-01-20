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
    """토큰 사용 처리 함수. total_tokens에서 사용한 토큰을 차감합니다."""
    user_tokens = db.query(models.Token).filter(models.Token.user_id == user_id).first()

    if not user_tokens:
        raise HTTPException(
            status_code=404,
            detail="Token information not found for this user"
        )

    # 잔여 토큰이 충분한지 확인
    if user_tokens.total_tokens < tokens:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "not_enough_tokens",
                "message": "스톤이 부족합니다. 스톤을 충전해주세요."
            }
        )

    try:
        # 잔여 토큰에서 차감
        user_tokens.total_tokens -= tokens
        # 누적 사용량 증가
        user_tokens.used_tokens += tokens

        # 사용 기록 추가
        usage_history = models.TokenUsageHistory(
            user_id=user_id,
            conversation_id=None,  # conversation_id는 필요한 경우 별도로 설정
            tokens_used=tokens,
            used_at=datetime.now()
        )
        db.add(usage_history)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update token usage: {str(e)}"
        )