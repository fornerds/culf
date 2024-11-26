from sqlalchemy.orm import Session
from . import models, schemas
from uuid import UUID
import logging
from typing import Optional, List


def create_inquiry(db: Session, inquiry: schemas.InquiryCreate, user_id: UUID) -> models.Inquiry:
    """
    Create a new inquiry in the database
    """
    try:
        attachments_json = [att.dict() for att in inquiry.attachments] if inquiry.attachments else None

        db_inquiry = models.Inquiry(
            user_id=user_id,
            title=inquiry.title,
            email=inquiry.email,
            contact=inquiry.contact,
            content=inquiry.content,
            attachments=attachments_json,
            status=models.InquiryStatus.RECEIVED.value  # Use Enum value
        )

        db.add(db_inquiry)
        db.commit()
        db.refresh(db_inquiry)

        logging.info(f"Created inquiry {db_inquiry.inquiry_id} for user {user_id}")
        return db_inquiry

    except Exception as e:
        db.rollback()
        logging.error(f"Error creating inquiry: {str(e)}")
        raise