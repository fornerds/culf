from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.domains.user import schemas as user_schemas
from . import schemas, services
from typing import List
from uuid import UUID

router = APIRouter()

@router.get("/users/me/notifications", response_model=schemas.NotificationList)
def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """현재 사용자의 알림 목록을 조회합니다."""
    notifications, total_count = services.get_user_notifications(
        db, current_user.user_id, skip=(page - 1) * limit, limit=limit
    )
    return {
        "notifications": notifications,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }

@router.get("/users/me/notifications/{notification_id}", response_model=schemas.NotificationResponse)
def get_notification_detail(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """특정 알림의 상세 정보를 조회합니다."""
    notification = services.get_notification(db, notification_id, current_user.user_id)
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
    return notification

@router.put("/users/me/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """특정 알림을 읽음 처리합니다."""
    notification = services.mark_notification_as_read(db, notification_id, current_user.user_id)
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
    return notification

@router.put("/users/me/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """사용자의 모든 알림을 읽음 처리합니다."""
    services.mark_all_notifications_as_read(db, current_user.user_id)
    return {"message": "모든 알림이 읽음 처리되었습니다"}

@router.get("/users/me/notification-settings", response_model=List[schemas.NotificationSetting])
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """사용자의 알림 설정을 조회합니다."""
    return services.get_user_notification_settings(db, current_user.user_id)

@router.put("/users/me/notification-settings", response_model=List[schemas.NotificationSetting])
def update_notification_settings(
    settings: List[schemas.NotificationSettingUpdate],
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """알림 설정을 업데이트합니다."""
    return services.update_notification_settings(db, current_user.user_id, settings)