from sqlalchemy.orm import Session
from . import models, schemas
from typing import List, Optional
from app.utils.s3_client import upload_file_to_s3
from app.utils.cloudfront_utils import get_cloudfront_url, invalidate_cloudfront_cache
from app.core.config import settings
from fastapi import HTTPException
import uuid
import logging
from .models import Curator, CuratorTagHistory
from sqlalchemy.sql import func

def get_or_create_tag(db: Session, tag_name: str) -> models.Tag:
    """태그를 조회하거나 없으면 생성"""
    tag = db.query(models.Tag).filter(models.Tag.name == tag_name).first()
    if not tag:
        tag = models.Tag(name=tag_name)
        db.add(tag)
        db.commit()
        db.refresh(tag)
    return tag

def upload_image(file, prefix):
    """이미지 업로드 헬퍼 함수"""
    try:
        file_extension = file.filename.split('.')[-1]
        object_name = f"curators/{prefix}/{uuid.uuid4()}.{file_extension}"

        if upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name):
            image_url = get_cloudfront_url(object_name)
            invalidate_cloudfront_cache(object_name)
            return image_url
        raise HTTPException(status_code=500, detail="이미지 업로드에 실패했습니다.")
    except Exception as e:
        logging.error(f"Image upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="이미지 처리 중 오류가 발생했습니다.")


def create_curator(db: Session, curator: schemas.CuratorCreate, main_image=None, profile_image=None):
    """큐레이터 생성"""
    # 이미지 업로드
    main_image_url = None
    profile_image_url = None

    if main_image:
        main_image_url = upload_image(main_image, "main")
    if profile_image:
        profile_image_url = upload_image(profile_image, "chat")

    # 태그 처리
    tags = []
    for tag_name in curator.tag_names:
        tag = get_or_create_tag(db, tag_name)
        tags.append(tag)

    # DB에 저장
    db_curator = models.Curator(
        name=curator.name,
        persona=curator.persona,
        main_image=main_image_url,
        profile_image=profile_image_url,
        introduction=curator.introduction,
        category=curator.category,
        tags=tags
    )

    try:
        db.add(db_curator)
        db.commit()
        db.refresh(db_curator)
        return db_curator
    except Exception as e:
        db.rollback()
        logging.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail="큐레이터 생성 중 오류가 발생했습니다.")

def get_curators(db: Session, category: Optional[str] = None, tag: Optional[str] = None) -> List[models.Curator]:
    """큐레이터 목록 조회"""
    query = db.query(models.Curator)

    if category:
        query = query.filter(models.Curator.category == category)

    if tag:
        query = query.join(models.curator_tags).join(models.Tag).filter(models.Tag.name == tag)

    return query.all()


def update_curator(db: Session, curator_id: int, curator: schemas.CuratorUpdate, main_image=None, profile_image=None):
    """큐레이터 정보 수정"""
    db_curator = db.query(models.Curator).filter(models.Curator.curator_id == curator_id).first()
    if not db_curator:
        return None

    # 이미지 업로드 처리
    if main_image:
        main_image_url = upload_image(main_image, "main")
        setattr(db_curator, "main_image", main_image_url)

    if profile_image:
        profile_image_url = upload_image(profile_image, "chat")
        setattr(db_curator, "profile_image", profile_image_url)

    # 기본 필드 업데이트
    update_data = curator.dict(exclude={'tag_names'}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_curator, field, value)

    # 태그 업데이트
    if curator.tag_names is not None:
        db_curator.tags = []
        for tag_name in curator.tag_names:
            tag = get_or_create_tag(db, tag_name)
            db_curator.tags.append(tag)

        # 태그 히스토리 저장
        tag_history = CuratorTagHistory(
            curator_id=curator_id,
            tag_names=curator.tag_names,
            created_at=func.now()  # 현재 시간으로 저장
        )
        db.add(tag_history)

    try:
        db.add(db_curator)
        db.commit()
        db.refresh(db_curator)
        return db_curator
    except Exception as e:
        db.rollback()
        logging.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail="큐레이터 수정 중 오류가 발생했습니다.")

def get_curator(db: Session, curator_id: int):
    """특정 큐레이터 조회"""
    return db.query(models.Curator).filter(models.Curator.curator_id == curator_id).first()


def delete_curator(db: Session, curator_id: int):
    """큐레이터 삭제"""
    db_curator = get_curator(db, curator_id)
    if db_curator:
        db.delete(db_curator)
        db.commit()
        return True
    return False

def update_curator_tags(db: Session, curator_id: int, tag_names: List[str]) -> Curator:
    curator = db.query(Curator).filter(Curator.curator_id == curator_id).first()
    if not curator:
        raise HTTPException(status_code=404, detail="Curator not found")

    # 태그 갱신
    curator.tags = []
    for tag_name in tag_names:
        tag = get_or_create_tag(db, tag_name)
        curator.tags.append(tag)

    # 태그 히스토리 저장
    history = CuratorTagHistory(
        curator_id=curator_id,
        tag_names=tag_names
    )
    db.add(history)
    db.commit()
    db.refresh(curator)
    return curator