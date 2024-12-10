from datetime import date
from sqlalchemy.orm import Session
from . import models, schemas
from app.utils.s3_client import upload_file_to_s3, delete_file_from_s3
from app.utils.cloudfront_utils import get_cloudfront_url, invalidate_cloudfront_cache
from app.core.config import settings
import uuid

def create_banner(db: Session, banner: schemas.BannerCreate, image_file=None):
    """배너 생성"""
    image_url = None
    if image_file:
        file_extension = image_file.filename.split('.')[-1]
        object_name = f"banners/{uuid.uuid4()}.{file_extension}"
        
        if upload_file_to_s3(image_file.file, settings.S3_BUCKET_NAME, object_name):
            image_url = get_cloudfront_url(object_name)
            invalidate_cloudfront_cache(object_name)

    db_banner = models.Banner(
        image_url=image_url,
        target_url=banner.target_url,
        start_date=banner.start_date,
        end_date=banner.end_date,
        is_public=banner.is_public
    )
    
    db.add(db_banner)
    db.commit()
    db.refresh(db_banner)
    return db_banner

def get_banners(db: Session, skip: int = 0, limit: int = 100, is_public: bool = None):
    """전체 배너 목록 조회 (관리자용)"""
    query = db.query(models.Banner)
    if is_public is not None:
        query = query.filter(models.Banner.is_public == is_public)
    return query.offset(skip).limit(limit).all()

def get_active_banners(db: Session):
    """현재 활성화된 배너 목록 조회"""
    today = date.today()
    return db.query(models.Banner).filter(
        models.Banner.start_date <= today,
        models.Banner.end_date >= today,
        models.Banner.is_public == True
    ).all()

def get_banner(db: Session, banner_id: int):
    """특정 배너 조회"""
    return db.query(models.Banner).filter(models.Banner.banner_id == banner_id).first()

def update_banner(db: Session, banner_id: int, banner_update: schemas.BannerUpdate, image_file=None):
    """배너 정보 수정"""
    db_banner = get_banner(db, banner_id)
    if not db_banner:
        return None

    if image_file:
        file_extension = image_file.filename.split('.')[-1]
        object_name = f"banners/{uuid.uuid4()}.{file_extension}"
        
        if upload_file_to_s3(image_file.file, settings.S3_BUCKET_NAME, object_name):
            image_url = get_cloudfront_url(object_name)
            db_banner.image_url = image_url
            invalidate_cloudfront_cache(object_name)

    update_data = banner_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_banner, key, value)

    db.add(db_banner)
    db.commit()
    db.refresh(db_banner)
    return db_banner

def delete_banner(db: Session, banner_id: int):
    """배너 삭제"""
    banner = db.query(models.Banner).filter(models.Banner.banner_id == banner_id).first()
    if banner:
        # S3에서 이미지 파일 삭제
        object_name = banner.image_url.split('/')[-1]
        if delete_file_from_s3(settings.S3_BUCKET_NAME, f"banners/{object_name}"):
            # DB에서 배너 정보 삭제
            db.delete(banner)
            db.commit()
            return True
    return False