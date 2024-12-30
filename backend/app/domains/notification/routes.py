from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_user, get_current_active_superuser
from app.domains.user import schemas as user_schemas
from app.domains.notification import schemas as notification_schemas
from typing import List
from app.domains.notification import services as notification_services
from uuid import UUID
from app.domains.user.models import User

router = APIRouter()

@router.get("/users/me/notifications", response_model=notification_schemas.NotificationList)
def get_notifications(
   page: int = Query(1, ge=1),
   limit: int = Query(10, ge=1, le=100),
   db: Session = Depends(get_db),
   current_user: user_schemas.User = Depends(get_current_active_user)
):
    """현재 사용자의 알림 목록을 조회합니다."""
    notifications, total_count = notification_services.get_user_notifications(
        db, current_user.user_id, skip=(page - 1) * limit, limit=limit
    )
    return notification_schemas.NotificationList(
        notifications=notifications,
        total_count=total_count,
        page=page,
        limit=limit
    )

@router.get("/users/me/notifications/{notification_id}", response_model=notification_schemas.Notification)
def read_notification(
    notification_id: int = Path(..., description="조회할 알림의 ID", example=1),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """특정 알림의 상세 정보를 조회합니다."""
    notification = notification_services.get_notification(db, notification_id, current_user.user_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
    return notification

@router.put("/users/me/notifications/{notification_id}/read", response_model=notification_schemas.Notification)
def mark_notification_read(
    notification_id: int = Path(..., description="읽음 처리할 알림의 ID", example=1),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """특정 알림을 읽음 처리합니다."""
    notification = notification_services.mark_notification_as_read(db, notification_id, current_user.user_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
    return notification

@router.put("/users/me/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """사용자의 모든 알림을 읽음 처리합니다."""
    notification_services.mark_all_notifications_as_read(db, current_user.user_id)
    return {"message": "모든 알림이 읽음 처리되었습니다"}

@router.get("/users/me/notification-settings", response_model=List[notification_schemas.NotificationSetting])
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """사용자의 알림 설정을 조회합니다."""
    return notification_services.get_user_notification_settings(db, current_user.user_id)

@router.put("/users/me/notification-settings", response_model=List[notification_schemas.NotificationSetting])
def update_notification_settings(
    settings: List[notification_schemas.NotificationSettingUpdate],
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """알림 설정을 업데이트합니다."""
    return notification_services.update_notification_settings(
        db=db,
        user_id=current_user.user_id,
        settings=settings
    )

# 관리자용 API
@router.post("/admin/notifications", response_model=notification_schemas.NotificationResponse)
def create_notification(
    notification: notification_schemas.NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """관리자가 특정 사용자에게 알림을 생성합니다."""
    return notification_services.create_notification(
        db=db,
        user_id=notification.user_id,
        type=notification.type,
        message=notification.message
    )