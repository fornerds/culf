from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.domains.token.models import TokenPlan, Token
from app.domains.token.schemas import TokenPlanCreate, TokenPlanUpdate
from uuid import UUID

class TokenService:
    @staticmethod
    def get_all_token_plans(db: Session) -> List[TokenPlan]:
        return db.query(TokenPlan).all()

    @staticmethod
    def get_token_plan(db: Session, token_plan_id: int) -> TokenPlan:
        return db.query(TokenPlan).filter(TokenPlan.token_plan_id == token_plan_id).first()

    @staticmethod
    def create_token_plan(db: Session, token_plan: TokenPlanCreate) -> TokenPlan:
        db_token_plan = TokenPlan(**token_plan.dict())
        db.add(db_token_plan)
        db.commit()
        db.refresh(db_token_plan)
        return db_token_plan

    @staticmethod
    def update_token_plan(db: Session, token_plan_id: int, token_plan: TokenPlanUpdate) -> TokenPlan:
        db_token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == token_plan_id).first()
        if not db_token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")
        
        for field, value in token_plan.dict(exclude_unset=True).items():
            setattr(db_token_plan, field, value)
        
        db.commit()
        db.refresh(db_token_plan)
        return db_token_plan

    @staticmethod
    def delete_token_plan(db: Session, token_plan_id: int):
        db_token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == token_plan_id).first()
        if not db_token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")
        
        db.delete(db_token_plan)
        db.commit()

    # 사용자 토큰 정보 조회 메서드 추가
    @staticmethod
    def get_user_token_info(db: Session, user_id: UUID) -> Token:
        return db.query(Token).filter(Token.user_id == user_id).first()
