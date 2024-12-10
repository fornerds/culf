from sqlalchemy.orm import Session
from . import models, schemas
from typing import List, Optional
from app.utils.s3_client import upload_file_to_s3
from app.core.config import settings
import uuid

def create_curator(db: Session, curator: schemas.CuratorCreate, profile_image=None):
    """큐레이터 생성"""
    # 이미지 업로드
    image_url = None
    if profile_image:
        file_extension = profile_image.filename.split('.')[-1]
        object_name = f"curators/{uuid.uuid4()}.{file_extension}"
        
        if upload_file_to_s3(profile_image.file, settings.S3_BUCKET_NAME, object_name):
            image_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{object_name}"

    # DB에 저장
    db_curator = models.Curator(
        name=curator.name,
        profile_image=image_url,
        introduction=curator.introduction,
        category=curator.category
    )
    
    db.add(db_curator)
    db.commit()
    db.refresh(db_curator)
    return db_curator

def get_curators(db: Session, category: Optional[str] = None) -> List[models.Curator]:
    """큐레이터 목록 조회"""
    query = db.query(models.Curator)
    if category:
        query = query.filter(models.Curator.category == category)
    return query.all()

def get_curator(db: Session, curator_id: int):
    """특정 큐레이터 조회"""
    return db.query(models.Curator).filter(models.Curator.curator_id == curator_id).first()

def update_curator(db: Session, curator_id: int, curator: schemas.CuratorUpdate):
    """큐레이터 정보 수정"""
    db_curator = get_curator(db, curator_id)
    if db_curator:
        update_data = curator.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_curator, key, value)
        db.add(db_curator)
        db.commit()
        db.refresh(db_curator)
    return db_curator

def delete_curator(db: Session, curator_id: int):
    """큐레이터 삭제"""
    db_curator = get_curator(db, curator_id)
    if db_curator:
        db.delete(db_curator)
        db.commit()
        return True
    return False