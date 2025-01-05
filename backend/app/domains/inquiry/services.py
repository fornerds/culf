from sqlalchemy.orm import Session
import json
from . import models, schemas
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi.encoders import jsonable_encoder


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


def create_inquiry(db: Session, inquiry_data: schemas.InquiryCreate):
    """문의사항 생성"""
    db_inquiry = models.Inquiry(
        type="GENERAL",
        title=inquiry_data.title,
        email=inquiry_data.email,
        contact=inquiry_data.contact,
        content=inquiry_data.content,
        attachments=jsonable_encoder(inquiry_data.attachments) if inquiry_data.attachments else None,
        status='PENDING'
    )

    try:
        db.add(db_inquiry)
        db.commit()
        db.refresh(db_inquiry)
        return db_inquiry
    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to create inquiry: {str(e)}")


def get_inquiry(db: Session, inquiry_id: int) -> Optional[models.Inquiry]:
    """문의사항 조회"""
    inquiry = db.query(models.Inquiry).filter(models.Inquiry.inquiry_id == inquiry_id).first()
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
    query = db.query(models.Inquiry)

    if status:
        query = query.filter(models.Inquiry.status == status)

    if start_date and end_date:
        query = query.filter(models.Inquiry.created_at.between(start_date, end_date))

    inquiries = query \
        .order_by(models.Inquiry.created_at.desc()) \
        .offset(skip) \
        .limit(limit) \
        .all()

    # Process attachments for each inquiry
    for inquiry in inquiries:
        inquiry.attachments = _process_attachments(inquiry.attachments)

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