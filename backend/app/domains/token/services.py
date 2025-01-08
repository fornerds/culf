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
    user_tokens = db.query(models.Token).filter(models.Token.user_id == user_id).first()
    if user_tokens:
        user_tokens.used_tokens += tokens
