from sqlalchemy.orm import Session
from . import models, schemas
from typing import List, Tuple
from uuid import UUID
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
import logging

def get_user_notifications(db: Session, user_id: UUID, skip: int = 0, limit: int = 100) -> Tuple[List[models.Notification], int]:
    query = db.query(models.Notification).filter(models.Notification.user_id == user_id)
    total_count = query.count()
    notifications = query.order_by(models.Notification.created_at.desc()).offset(skip).limit(limit).all()
    return notifications, total_count

def get_notification(db: Session, notification_id: int, user_id: UUID) -> models.Notification:
    return db.query(models.Notification).filter(
        models.Notification.notification_id == notification_id,
        models.Notification.user_id == user_id
    ).first()

def mark_notification_as_read(db: Session, notification_id: int, user_id: UUID) -> models.Notification:
    notification = get_notification(db, notification_id, user_id)
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification

def mark_all_notifications_as_read(db: Session, user_id: UUID):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()

def update_notification_settings(db: Session, user_id: UUID, settings: List[schemas.NotificationSettingUpdate]) -> List[models.UserNotificationSetting]:
    updated_settings = []
    for setting in settings:
        try:
            db_setting = db.query(models.UserNotificationSetting).filter(
                models.UserNotificationSetting.user_id == user_id,
                models.UserNotificationSetting.notification_type == setting.notification_type
            ).first()

            if db_setting:
                db_setting.is_enabled = setting.is_enabled
            else:
                db_setting = models.UserNotificationSetting(
                    user_id=user_id,
                    notification_type=setting.notification_type,
                    is_enabled=setting.is_enabled
                )
                db.add(db_setting)

            db.commit()
            db.refresh(db_setting)
            updated_settings.append(db_setting)
        except SQLAlchemyError as e:
            db.rollback()
            logging.error(f"Error updating user notification settings: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error occurred")

    return updated_settings

def get_user_notification_settings(db: Session, user_id: UUID) -> List[models.UserNotificationSetting]:
    return db.query(models.UserNotificationSetting).filter(
        models.UserNotificationSetting.user_id == user_id
    ).all()

def create_notification(db: Session, user_id: UUID, type: str, message: str) -> models.Notification:
    """새로운 알림을 생성합니다."""
    notification = models.Notification(
        user_id=user_id,
        type=type,
        message=message,
        is_read=False
    )
    try:
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create notification")