from datetime import date
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from pydantic import HttpUrl
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.domains.banner import schemas as banner_schemas
from app.domains.banner import services as banner_services
from app.domains.curator import schemas as curator_schemas
from app.domains.curator import services as curator_services
from app.core.deps import get_current_active_superuser
from app.domains.user.models import User
from typing import List, Optional
from app.core.config import settings

router = APIRouter()

def get_current_admin_user(
    current_user: User = Depends(get_current_active_superuser)
) -> User:
    if settings.DEV_MODE:
        # In development mode, return a mock admin user
        return User(user_id=1, email="admin@example.com", role="ADMIN")
    return current_user

@router.post("/banners", response_model=banner_schemas.Banner)
async def create_banner(
    image_file: UploadFile = File(..., description="Banner image file"),
    target_url: Optional[HttpUrl] = Form(None, description="URL to redirect when banner is clicked"),
    start_date: date = Form(..., description="Banner start date (YYYY-MM-DD)"),
    end_date: date = Form(..., description="Banner end date (YYYY-MM-DD)"),
    is_public: bool = Form(True, description="Whether the banner is public"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 생성

    - **image_file**: 배너 이미지 파일 (필수)
    - **target_url**: 배너 클릭 시 이동할 URL (선택, 없으면 클릭 시 아무 동작 없음)
    - **start_date**: 배너 시작 날짜 (YYYY-MM-DD 형식, 필수)
    - **end_date**: 배너 종료 날짜 (YYYY-MM-DD 형식, 필수)
    - **is_public**: 배너 공개 여부 (기본값: True)

    관리자 권한이 필요합니다.
    이미지 파일은 S3에 자동으로 업로드되며, 생성된 URL이 배너 정보에 저장됩니다.
    """
    banner_data = banner_schemas.BannerCreate(
        target_url=target_url,
        start_date=start_date,
        end_date=end_date,
        is_public=is_public
    )
    return banner_services.create_banner(db, banner_data, image_file)

@router.get("/banners", response_model=List[banner_schemas.Banner])
async def read_banners(
    skip: int = 0,
    limit: int = 100,
    is_public: bool = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 목록 조회

    - **skip**: 건너뛸 배너 수 (기본값: 0)
    - **limit**: 반환할 최대 배너 수 (기본값: 100)
    - **is_public**: 공개 여부로 필터링 (선택적)

    관리자 권한이 필요합니다.
    """
    banners = banner_services.get_banners(db, skip=skip, limit=limit, is_public=is_public)
    return banners

@router.get("/banners/{banner_id}", response_model=banner_schemas.Banner)
async def read_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    특정 배너 조회

    - **banner_id**: 조회할 배너의 ID

    관리자 권한이 필요합니다.
    """
    db_banner = banner_services.get_banner(db, banner_id=banner_id)
    if db_banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    return db_banner

@router.put("/banners/{banner_id}", response_model=banner_schemas.Banner)
async def update_banner(
    banner_id: int,
    banner: banner_schemas.BannerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 수정

    - **banner_id**: 수정할 배너의 ID
    - **banner**: 수정할 배너 정보

    관리자 권한이 필요합니다.
    수정하지 않을 필드는 요청 본문에서 생략 가능합니다.
    """
    db_banner = banner_services.update_banner(db, banner_id, banner)
    if db_banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    return db_banner

@router.delete("/banners/{banner_id}", status_code=204)
async def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 삭제

    - **banner_id**: 삭제할 배너의 ID

    관리자 권한이 필요합니다.
    배너 삭제 시 S3에 저장된 이미지 파일도 함께 삭제됩니다.
    """
    success = banner_services.delete_banner(db, banner_id)
    if not success:
        raise HTTPException(status_code=404, detail="Banner not found")
    return {"ok": True}

@router.post("/curators", response_model=curator_schemas.Curator)
async def create_curator(
    curator: curator_schemas.CuratorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 생성

    - **curator**: 큐레이터 정보

    관리자 권한이 필요합니다.
    """
    return curator_services.create_curator(db, curator)

@router.get("/curators", response_model=List[curator_schemas.Curator])
async def read_curators(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 목록 조회

    - **skip**: 건너뛸 큐레이터 수 (기본값: 0)
    - **limit**: 반환할 최대 큐레이터 수 (기본값: 100)

    관리자 권한이 필요합니다.
    """
    curators = curator_services.get_curators(db, skip=skip, limit=limit)
    return curators

@router.get("/curators/{curator_id}", response_model=curator_schemas.Curator)
async def read_curator(
    curator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    특정 큐레이터 조회

    - **curator_id**: 조회할 큐레이터의 ID

    관리자 권한이 필요합니다.
    """
    db_curator = curator_services.get_curator(db, curator_id=curator_id)
    if db_curator is None:
        raise HTTPException(status_code=404, detail="Curator not found")
    return db_curator

@router.put("/curators/{curator_id}", response_model=curator_schemas.Curator)
async def update_curator(
    curator_id: int,
    curator: curator_schemas.CuratorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 수정

    - **curator_id**: 수정할 큐레이터의 ID
    - **curator**: 수정할 큐레이터 정보

    관리자 권한이 필요합니다.
    수정하지 않을 필드는 요청 본문에서 생략 가능합니다.
    """
    db_curator = curator_services.update_curator(db, curator_id, curator)
    if db_curator is None:
        raise HTTPException(status_code=404, detail="Curator not found")
    return db_curator

@router.delete("/curators/{curator_id}", status_code=204)
async def delete_curator(
    curator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 삭제

    - **curator_id**: 삭제할 큐레이터의 ID

    관리자 권한이 필요합니다.
    """
    success = curator_services.delete_curator(db, curator_id)
    if not success:
        raise HTTPException(status_code=404, detail="Curator not found")
    return {"ok": True}