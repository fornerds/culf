from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.domains.user import schemas as user_schemas
from app.domains.notification import schemas as notification_schemas
from typing import List
from app.domains.notification import services as notification_services

router = APIRouter()

@router.get("/users/me/notifications", response_model=notification_schemas.NotificationList)
def read_notifications(
    page: int = Query(1, ge=1, description="페이지 번호", example=1),
    limit: int = Query(10, ge=1, le=100, description="페이지당 항목 수", example=10),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    현재 사용자의 알림 목록을 조회합니다.
    """
    notifications, total_count = notification_services.get_user_notifications(
        db, current_user.user_id, skip=(page - 1) * limit, limit=limit
    )
    return {
        "notifications": notifications,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }

@router.get("/users/me/notifications/{notification_id}", response_model=notification_schemas.Notification)
def read_notification(
    notification_id: int = Path(..., description="조회할 알림의 ID", example=1),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    특정 알림의 상세 정보를 조회합니다.
    """
    notification = notification_services.get_notification(db, notification_id, current_user.user_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.put("/users/me/notifications/{notification_id}/read", response_model=notification_schemas.Notification)
def mark_notification_read(
    notification_id: int = Path(..., description="읽음 처리할 알림의 ID", example=1),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    특정 알림을 읽음 처리합니다.
    """
    notification = notification_services.mark_notification_as_read(db, notification_id, current_user.user_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.put("/users/me/notification-settings", response_model=List[notification_schemas.NotificationSetting])
def update_notification_settings(
    settings: List[notification_schemas.NotificationSettingUpdate] = Body(
        ...,
        example=[
            {"notification_type": "EMAIL", "is_enabled": True},
            {"notification_type": "PUSH", "is_enabled": False}
        ]
    ),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    알림 설정을 업데이트합니다.
    """
    updated_settings = notification_services.update_notification_settings(db, current_user.user_id, settings)
    return updated_settings


@router.put("/users/me/notification-settings", response_model=List[notification_schemas.UserNotificationSetting])
def update_notification_settings(
    settings: List[notification_schemas.UserNotificationSettingUpdate] = Body(
        ...,
        example=[
            {"notification_type": "EMAIL", "is_enabled": True},
            {"notification_type": "PUSH", "is_enabled": False}
        ]
    ),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    알림 설정을 업데이트합니다.
    """
    updated_settings = notification_services.update_notification_settings(db, current_user.user_id, settings)
    return updated_settings