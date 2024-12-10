from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
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
    name: str = Form(...),
    introduction: str = Form(...),
    category: str = Form(...),
    profile_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 생성 """
    curator_data = schemas.CuratorCreate(
        name=name,
        introduction=introduction,
        category=category
    )
    return curator_services.create_curator(db, curator_data, profile_image)

@router.get("/curators", response_model=List[schemas.Curator])
def read_curators(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """큐레이터 목록 조회"""
    return curator_services.get_curators(db, category=category)

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
async def update_curator(
    curator_id: int,
    name: str = Form(...),
    introduction: str = Form(...),
    category: str = Form(...),
    profile_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """큐레이터 정보 수정"""
    curator_data = schemas.CuratorUpdate(
        name=name,
        introduction=introduction,
        category=category
    )
    
    # 이미지가 제공된 경우 업로드
    if profile_image:
        file_extension = profile_image.filename.split('.')[-1]
        object_name = f"curators/{uuid.uuid4()}.{file_extension}"
        
        if upload_file_to_s3(profile_image.file, settings.S3_BUCKET_NAME, object_name):
            curator_data.profile_image = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{object_name}"

    updated_curator = curator_services.update_curator(db, curator_id=curator_id, curator=curator_data)
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