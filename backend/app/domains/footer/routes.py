from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.deps import get_current_admin_user
from . import schemas, services

router = APIRouter()

@router.get("/footer", response_model=schemas.FooterResponse)
async def get_footer(db: Session = Depends(get_db)):
    """현재 활성화된 푸터 정보를 조회합니다."""
    footer = services.get_active_footer(db)
    if not footer:
        raise HTTPException(status_code=404, detail="Footer information not found")
    return footer

@router.post("/admin/footer", response_model=schemas.FooterResponse)
async def create_footer(
    footer: schemas.FooterCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """새로운 푸터 정보를 생성합니다."""
    return services.create_footer(db, footer)

@router.put("/admin/footer/{footer_id}", response_model=schemas.FooterResponse)
async def update_footer(
    footer_id: int,
    footer: schemas.FooterUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """푸터 정보를 업데이트합니다."""
    return services.update_footer(db, footer_id, footer)

@router.get("/admin/footer/history", response_model=List[schemas.FooterResponse])
async def get_footer_history(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """푸터 정보 변경 이력을 조회합니다."""
    return services.get_footer_history(db, skip, limit)