from sqlalchemy.orm import Session
import json
from . import models
from app.core.config import settings
from app.utils.s3_client import upload_file_to_s3
from app.utils.cloudfront_utils import get_cloudfront_url
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException, UploadFile
from app.domains.user.models import User
import uuid


def _process_attachments(attachments):
    """Helper function to process attachments data"""
    if attachments is None:
        return None
    if isinstance(attachments, str):
        if attachments.lower() == 'null':
            return None
        try:
            # Try to parse string as JSON if it's a string
            return json.loads(attachments)
        except json.JSONDecodeError:
            return None
    return attachments

def process_attachments(attachments: Optional[List[UploadFile]]) -> List[str]:
    """
    첨부 파일 검증 및 S3 업로드 후 URL 리스트를 반환합니다.
    첨부 파일이 없는 경우 빈 리스트를 반환합니다.
    """
    if not attachments:
        return []

    allowed_content_types = {"image/jpeg", "image/jpg", "image/png", "image/gif"}
    attachment_urls = []

    if attachments:
        for file in attachments:
            # 파일 형식 검증
            content_type = file.content_type.lower()
            if content_type not in allowed_content_types:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "invalid_file_type",
                        "message": f"지원하지 않는 파일 형식입니다. ({file.filename})"
                    }
                )

            # S3 업로드
            file_extension = file.filename.split('.')[-1].lower()
            object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

            if upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name):
                file_url = get_cloudfront_url(object_name)
                attachment_urls.append(file_url)

    return attachment_urls

def create_inquiry(db: Session, inquiry_data: dict):
    """문의사항 생성"""
    try:
        db_inquiry = models.Inquiry(
            type="GENERAL",  # 기본값으로 GENERAL 설정
            user_id=inquiry_data.get("user_id"),
            title=inquiry_data["title"],
            email=inquiry_data["email"],
            contact=inquiry_data["contact"],
            content=inquiry_data["content"],
            attachments=inquiry_data["attachments"],  # URL 리스트
            status='PENDING'
        )

        db.add(db_inquiry)
        db.commit()
        db.refresh(db_inquiry)
        return db_inquiry

    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create inquiry: {str(e)}")


def get_inquiry(db: Session, inquiry_id: int) -> Optional[models.Inquiry]:
    """문의사항 조회"""
    inquiry = db.query(models.Inquiry).join(
        User,
        models.Inquiry.user_id == User.user_id,
        isouter=True  # LEFT OUTER JOIN
    ).filter(
        models.Inquiry.inquiry_id == inquiry_id
    ).first()

    if inquiry:
        inquiry.attachments = _process_attachments(inquiry.attachments)
    return inquiry

def get_user_inquiries(
        db: Session,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
) -> List[models.Inquiry]:
    """사용자의 문의사항 목록 조회"""
    inquiries = db.query(models.Inquiry) \
        .filter(models.Inquiry.user_id == user_id) \
        .order_by(models.Inquiry.created_at.desc()) \
        .offset(skip) \
        .limit(limit) \
        .all()

    # Process attachments for each inquiry
    for inquiry in inquiries:
        inquiry.attachments = _process_attachments(inquiry.attachments)

    return inquiries


def get_admin_inquiries(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
) -> List[models.Inquiry]:
    """관리자용 문의사항 목록 조회"""
    query = db.query(models.Inquiry, User).join(
        User,
        models.Inquiry.user_id == User.user_id,
        isouter=True  # LEFT OUTER JOIN
    )

    if status:
        query = query.filter(models.Inquiry.status == status)

    if start_date and end_date:
        query = query.filter(models.Inquiry.created_at.between(start_date, end_date))

    results = query \
        .order_by(models.Inquiry.created_at.desc()) \
        .offset(skip) \
        .limit(limit) \
        .all()

    inquiries = []
    for inquiry, user in results:
        inquiry.user = user
        inquiry.attachments = _process_attachments(inquiry.attachments)
        inquiries.append(inquiry)

    return inquiries


def update_inquiry_status(
        db: Session,
        inquiry_id: int,
        status: str
) -> Optional[models.Inquiry]:
    """문의사항 상태 업데이트"""
    inquiry = get_inquiry(db, inquiry_id)
    if inquiry:
        inquiry.status = status
        db.commit()
        db.refresh(inquiry)
        inquiry.attachments = _process_attachments(inquiry.attachments)
    return inquiry