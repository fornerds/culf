from typing import List
from app.domains.token.schemas import TokenPlanCreate, TokenPlanUpdate, TokenPlanResponse, UserTokenResponse
from app.db.session import get_db
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user
from app.domains.user import schemas as user_schemas
from . import services, schemas

router = APIRouter()

@router.get("/admin/settings/tokens", response_model=List[schemas.TokenPlanResponse])
def read_token_plans(db: Session = Depends(get_db)):
    return services.get_all_token_plans(db)

@router.get("/admin/settings/tokens/{token_plan_id}", response_model=schemas.TokenPlanResponse)
def read_token_plan(token_plan_id: int, db: Session = Depends(get_db)):
    token_plan = services.get_token_plan(db, token_plan_id)
    if not token_plan:
        raise HTTPException(status_code=404, detail="Token plan not found")
    return token_plan

@router.post("/admin/settings/tokens", response_model=schemas.TokenPlanResponse)
def create_token_plan(token_plan: TokenPlanCreate, db: Session = Depends(get_db)):
    return services.create_token_plan(db, token_plan)

@router.put("/admin/settings/tokens/{token_plan_id}", response_model=schemas.TokenPlanResponse)
def update_token_plan(token_plan_id: int, token_plan: TokenPlanUpdate, db: Session = Depends(get_db)):
    return services.update_token_plan(db, token_plan_id, token_plan)

@router.delete("/admin/settings/tokens/{token_plan_id}", status_code=204)
def delete_token_plan(token_plan_id: int, db: Session = Depends(get_db)):
    services.delete_token_plan(db, token_plan_id)

@router.get("/users/me/tokens", response_model=schemas.UserTokenResponse)
def read_my_tokens(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    token_info = services.get_user_tokens(db, current_user.user_id)
    if not token_info:
        raise HTTPException(status_code=404, detail="Token information not found for this user")
    return token_info

@router.get("/tokens", response_model=schemas.TokenInfo)
def get_user_tokens(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    return services.get_user_tokens(db, current_user.user_id)