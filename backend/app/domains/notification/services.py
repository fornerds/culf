from sqlalchemy.orm import Session
from . import models, schemas
from typing import List, Tuple, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import func, case
from app.domains.user.models import User
import logging

from .models import NotificationType

logger = logging.getLogger(__name__)


def get_user_notifications(
        db: Session,
        user_id: UUID,
        skip: int = 0,
        limit: int = 100
) -> Tuple[List[dict], int]:
    """사용자의 알림 목록을 조회합니다."""
    query = db.query(
        models.Notification,
        models.UserNotification.is_read,
        models.UserNotification.read_at
    ).join(
        models.UserNotification,
        models.Notification.notification_id == models.UserNotification.notification_id
    ).filter(
        models.UserNotification.user_id == user_id
    )

    total_count = query.count()

    results = query.order_by(models.Notification.created_at.desc()) \
        .offset(skip) \
        .limit(limit) \
        .all()

    notifications = []
    for notif, is_read, read_at in results:
        notifications.append({
            "notification_id": notif.notification_id,
            "type": notif.type,
            "message": notif.message,
            "created_at": notif.created_at,
            "is_read": is_read or False,
            "read_at": read_at
        })

    return notifications, total_count


def get_notification(db: Session, notification_id: int, user_id: UUID) -> Optional[dict]:
    """특정 알림의 상세 정보를 조회합니다."""
    result = db.query(
        models.Notification,
        models.UserNotification.is_read,
        models.UserNotification.read_at
    ).join(
        models.UserNotification,
        models.Notification.notification_id == models.UserNotification.notification_id
    ).filter(
        models.UserNotification.notification_id == notification_id,
        models.UserNotification.user_id == user_id
    ).first()

    if result:
        notif, is_read, read_at = result
        return {
            "notification_id": notif.notification_id,
            "type": notif.type,
            "message": notif.message,
            "created_at": notif.created_at,
            "is_read": is_read or False,
            "read_at": read_at
        }
    return None


def mark_notification_as_read(db: Session, notification_id: int, user_id: UUID) -> Optional[dict]:
    """알림을 읽음 처리합니다."""
    user_notification = db.query(models.UserNotification).filter(
        models.UserNotification.notification_id == notification_id,
        models.UserNotification.user_id == user_id
    ).first()

    if user_notification:
        user_notification.is_read = True
        user_notification.read_at = datetime.now()
        db.commit()

        return get_notification(db, notification_id, user_id)
    return None


def create_notification(db: Session, notification_data: schemas.NotificationCreate) -> models.Notification:
    """새로운 알림을 생성합니다."""
    try:
        # 알림 생성
        db_notification = models.Notification(
            type=notification_data.type,
            message=notification_data.message
        )
        db.add(db_notification)
        db.flush()

        # 수신자가 지정된 경우
        if notification_data.user_ids:
            for user_id in notification_data.user_ids:
                # 알림 설정 확인
                if is_notification_enabled(db, UUID(user_id), notification_data.type):
                    user_notification = models.UserNotification(
                        user_id=UUID(user_id),
                        notification_id=db_notification.notification_id
                    )
                    db.add(user_notification)
        else:
            # 전체 사용자에게 알림 전송 (알림 설정 확인)
            users = db.query(User).filter(User.status == 'ACTIVE').all()
            for user in users:
                if is_notification_enabled(db, user.user_id, notification_data.type):
                    user_notification = models.UserNotification(
                        user_id=user.user_id,
                        notification_id=db_notification.notification_id
                    )
                    db.add(user_notification)

        db.commit()
        db.refresh(db_notification)
        return db_notification

    except Exception as e:
        db.rollback()
        logger.error(f"Error creating notification: {str(e)}")
        raise


def mark_all_notifications_as_read(db: Session, user_id: UUID):
    """사용자의 모든 알림을 읽음 처리합니다."""
    try:
        db.query(models.UserNotification).filter(
            models.UserNotification.user_id == user_id,
            models.UserNotification.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.now()
        })
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error marking all notifications as read: {str(e)}")
        raise


def get_user_notification_settings(db: Session, user_id: UUID) -> List[models.UserNotificationSetting]:
    """사용자의 알림 설정을 조회합니다."""
    return db.query(models.UserNotificationSetting).filter(
        models.UserNotificationSetting.user_id == user_id
    ).all()


def update_notification_settings(
        db: Session,
        user_id: UUID,
        settings: List[schemas.NotificationSettingUpdate]
) -> List[models.UserNotificationSetting]:
    """알림 설정을 업데이트합니다."""
    try:
        updated_settings = []
        for setting in settings:
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

            db.flush()
            updated_settings.append(db_setting)

        db.commit()
        return updated_settings

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating notification settings: {str(e)}")
        raise


def is_notification_enabled(db: Session, user_id: UUID, notification_type: NotificationType) -> bool:
    """사용자의 특정 알림 타입이 활성화되어 있는지 확인합니다."""
    setting = db.query(models.UserNotificationSetting).filter(
        models.UserNotificationSetting.user_id == user_id,
        models.UserNotificationSetting.notification_type == notification_type
    ).first()

    # 설정이 없으면 기본값은 True (알림 허용)
    return setting.is_enabled if setting else True