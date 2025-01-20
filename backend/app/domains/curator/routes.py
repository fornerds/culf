from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query, Body
from sqlalchemy.orm import Session
from app.domains.curator import schemas
from app.domains.curator import services as curator_services
from app.db.session import get_db
from app.core.deps import get_current_admin_user
from app.domains.user.models import User
from typing import List, Optional

router = APIRouter()


@router.post("/curators", response_model=schemas.Curator)
def create_curator(
        name: str = Form(..., description="큐레이터의 이름"),
        persona: str = Form(..., description="큐레이터의 페르소나 (예: 지구 예술에 푹 빠진 외계인)"),
        introduction: str = Form(..., description="큐레이터 소개"),
        category: str = Form(..., description="큐레이터 카테고리"),
        tag_names: List[str] = Form(..., description="태그 목록 (최대 2개)"),
        background_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 배경색 (#RRGGBB 형식)"),
        text_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 글자색 (#RRGGBB 형식)"),
        shadow_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 그림자색 (#RRGGBB 형식)"),
        main_image: UploadFile = File(..., description="메인 화면용 캐릭터 이미지"),
        profile_image: UploadFile = File(..., description="프로필 이미지"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 생성"""
    if len(tag_names) > 2:
        raise HTTPException(status_code=400, detail="태그는 최대 2개까지만 지정할 수 있습니다.")

    curator_data = schemas.CuratorCreate(
        name=name,
        persona=persona,
        introduction=introduction,
        category=category,
        tag_names=tag_names,
        background_color=background_color,
        text_color=text_color,
        shadow_color = shadow_color
    )
    return curator_services.create_curator(db, curator_data, main_image, profile_image)


@router.get("/curators", response_model=List[schemas.Curator])
def read_curators(
    category: Optional[str] = Query(None, description="카테고리로 필터링"),
    tag: Optional[str] = Query(None, description="태그로 필터링"),
    db: Session = Depends(get_db)
):
    """큐레이터 목록 조회"""
    return curator_services.get_curators(db, category=category, tag=tag)

@router.get("/curators/{curator_id}", response_model=schemas.Curator)
def read_curator(
    curator_id: int,
    db: Session = Depends(get_db)
):
    """특정 큐레이터 조회"""
    curator = curator_services.get_curator(db, curator_id=curator_id)
    if not curator:
        raise HTTPException(status_code=404, detail="큐레이터를 찾을 수 없습니다")
    return curator


@router.put("/curators/{curator_id}", response_model=schemas.Curator)
def update_curator(
        curator_id: int,
        name: Optional[str] = Form(None, description="큐레이터의 이름"),
        persona: Optional[str] = Form(None, description="큐레이터의 페르소나"),
        introduction: Optional[str] = Form(None, description="큐레이터 소개"),
        category: Optional[str] = Form(None, description="큐레이터 카테고리"),
        tag_names: Optional[List[str]] = Form(None, description="태그 목록 (최대 2개)"),
        background_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 배경색 (#RRGGBB 형식)"),
        text_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 글자색 (#RRGGBB 형식)"),
        shadow_color: Optional[str] = Form(None, description="큐레이터 메인 이미지의 그림자색 (#RRGGBB 형식)"),
        profile_image: Optional[UploadFile] = File(None, description="프로필 이미지"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 정보 수정"""
    if tag_names and len(tag_names) > 2:
        raise HTTPException(status_code=400, detail="태그는 최대 2개까지만 지정할 수 있습니다.")

    curator_data = schemas.CuratorUpdate(
        name=name,
        persona=persona,
        introduction=introduction,
        category=category,
        tag_names=tag_names,
        background_color=background_color,
        text_color=text_color,
        shadow_color=shadow_color
    )

    updated_curator = curator_services.update_curator(db, curator_id=curator_id, curator=curator_data,
                                                      profile_image=profile_image)
    if not updated_curator:
        raise HTTPException(status_code=404, detail="큐레이터를 찾을 수 없습니다")
    return updated_curator

@router.delete("/curators/{curator_id}", status_code=204)
def delete_curator(
    curator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 삭제"""
    success = curator_services.delete_curator(db, curator_id=curator_id)
    if not success:
        raise HTTPException(status_code=404, detail="큐레이터를 찾을 수 없습니다")
    return {"ok": True}

@router.get("/tags", response_model=List[schemas.Tag])
async def read_tags(db: Session = Depends(get_db)):
    """사용 가능한 모든 태그 목록을 조회합니다."""
    return curator_services.get_all_tags(db)

@router.put("/curators/{curator_id}/tags")
async def update_curator_tags_endpoint(
    curator_id: int,
    tag_names: List[str] = Body(..., max_items=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 태그 업데이트"""
    return curator_services.update_curator_tags(db, curator_id, tag_names)