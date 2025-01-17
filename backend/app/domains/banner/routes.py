from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.core.deps import get_current_user, get_current_active_superuser
from app.domains.user.models import User
from . import schemas, services

router = APIRouter()

@router.get("/banners", response_model=List[schemas.Banner])
async def get_active_banners(db: Session = Depends(get_db)):
    """현재 활성화된 배너 목록을 조회합니다."""
    return services.get_active_banners(db)

@router.get("/banners/all", response_model=List[schemas.Banner])
async def get_all_banners(
    skip: int = 0,
    limit: int = 100,
    is_public: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """전체 배너 목록을 조회합니다. (관리자용)"""
    return services.get_banners(db, skip=skip, limit=limit, is_public=is_public)

@router.post("/banners", response_model=schemas.Banner)
async def create_banner(
    image_file: UploadFile = File(..., description="배너 이미지 파일"),
    target_url: Optional[str] = Form(None, description="클릭 시 이동할 URL"),
    start_date: date = Form(..., description="시작일 (YYYY-MM-DD)"),
    end_date: date = Form(..., description="종료일 (YYYY-MM-DD)"),
    is_public: bool = Form(True, description="공개 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """배너를 생성합니다."""
    banner_data = schemas.BannerCreate(
        target_url=target_url,
        start_date=start_date,
        end_date=end_date,
        is_public=is_public
    )
    return services.create_banner(db, banner_data, image_file)

@router.get("/banners/{banner_id}", response_model=schemas.Banner)
async def get_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """특정 배너를 조회합니다."""
    banner = services.get_banner(db, banner_id=banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    return banner

@router.put("/banners/{banner_id}", response_model=schemas.Banner)
async def update_banner(
    banner_id: int,
    target_url: Optional[str] = Form(None),
    start_date: Optional[date] = Form(None),
    end_date: Optional[date] = Form(None),
    is_public: Optional[bool] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """배너를 수정합니다."""
    update_data = {}
    if target_url is not None:
        update_data["target_url"] = target_url
    if start_date is not None:
        update_data["start_date"] = start_date
    if end_date is not None:
        update_data["end_date"] = end_date
    if is_public is not None:
        update_data["is_public"] = is_public

    banner_update = schemas.BannerUpdate(**update_data)
    banner = services.update_banner(db, banner_id, banner_update, image_file)
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    return banner

@router.delete("/banners/{banner_id}", status_code=204)
async def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """배너를 삭제합니다."""
    success = services.delete_banner(db, banner_id)
    if not success:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    return {"ok": True}

@router.post("/banners/{banner_id}/click", response_model=schemas.Banner)
async def record_banner_click(
    banner_id: int,
    db: Session = Depends(get_db)
):
    """배너 클릭 횟수를 기록합니다."""
    banner = services.increment_banner_click(db, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="배너를 찾을 수 없습니다")
    return banner