import uuid
from datetime import timedelta, datetime
from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query, Body
from pydantic import HttpUrl
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import get_db
from app.domains.admin import services, schemas
from app.domains.admin.models import SystemSetting
from app.domains.admin.schemas import NotificationResponse, NotificationCreate, NotificationListResponse, \
    WelcomeTokenResponse, WelcomeTokenUpdate, TokenGrantResponse, TokenGrantCreate, SubscriptionPlanUpdate, \
    TokenPlanUpdate
from app.domains.token.models import Token
from app.domains.user import services as user_services
from app.domains.banner import schemas as banner_schemas
from app.domains.banner import services as banner_services
from app.domains.curator import schemas as curator_schemas
from app.domains.curator import services as curator_services
from app.core.deps import get_current_active_superuser, get_current_admin_user
from app.domains.user.models import User
from typing import List, Optional, Dict
from app.core.config import settings
from datetime import datetime, date
import logging

from app.utils.s3_client import upload_file_to_s3, get_cloudfront_url

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/users/search")
async def search_users(
    query: str = Query(..., description="이메일 또는 닉네임으로 검색"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    이메일 또는 닉네임으로 사용자를 검색합니다.
    관리자가 수동 결제를 생성할 때 사용됩니다.
    """
    search_result = db.query(User).filter(
        or_(
            User.email.ilike(f"%{query}%"),
            User.nickname.ilike(f"%{query}%")
        ),
        # 탈퇴한 사용자는 제외
        User.status != 'WITHDRAWN'
    ).all()

    users = [
        {
            "user_id": str(user.user_id),
            "email": user.email,
            "nickname": user.nickname,
            "status": user.status
        }
        for user in search_result
    ]

    return users

@router.get("/users/export")
async def export_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    전체 사용자 목록을 엑셀 다운로드용으로 조회합니다.
    """
    try:
        users = services.get_admin_users_for_export(db)
        return {"users": users}
    except Exception as e:
        logger.error(f"Error exporting users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/users/stats")
async def get_user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """사용자 통계 정보를 조회합니다."""
    try:
        stats = services.get_user_stats(db)
        return stats
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    sort: str = "created_at:desc",
    status: str = "all",
    token_filter: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """사용자 목록을 조회합니다."""
    try:
        result = services.get_admin_users(
            db=db,
            page=page,
            limit=limit,
            search=search,
            sort=sort,
            status=status,
            token_filter=token_filter
        )
        return {
            "users": result["users"],
            "total_count": result["total_count"],
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Error getting users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/users", response_model=schemas.AdminUserResponse)
async def create_user(
        user_data: schemas.AdminUserCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자가 새로운 사용자를 생성합니다."""
    try:
        # 이메일 중복 확인
        if user_services.get_user_by_email(db, email=user_data.email):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "validation_error",
                    "message": "이미 등록된 이메일 주소입니다."
                }
            )

        # 닉네임 중복 확인
        if user_services.get_user_by_nickname(db, nickname=user_data.nickname):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "validation_error",
                    "message": "이미 등록된 닉네임입니다."
                }
            )

        # 비밀번호 일치 확인
        if user_data.password != user_data.password_confirmation:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "validation_error",
                    "message": "비밀번호가 일치하지 않습니다."
                }
            )

        # 사용자 생성
        user = User(
            email=user_data.email,
            password=get_password_hash(user_data.password),
            nickname=user_data.nickname,
            phone_number=user_data.phone_number,
            birthdate=user_data.birthdate,
            gender=user_data.gender,
            status=user_data.status,
            role=user_data.role,
            marketing_agreed=False  # 기본값으로 설정
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        # 가입 축하 스톤 지급 로직
        welcome_tokens_setting = db.query(SystemSetting).filter(
            SystemSetting.key == 'welcome_tokens'
        ).first()

        if welcome_tokens_setting:
            welcome_tokens = int(welcome_tokens_setting.value)
            if welcome_tokens > 0:
                current_date = datetime.now()
                # Token 레코드 생성
                token = Token(
                    user_id=user.user_id,
                    total_tokens=welcome_tokens,
                    used_tokens=0,
                    onetime_tokens=welcome_tokens,  # 웰컴 토큰은 단건결제 토큰으로 처리
                    onetime_expires_at=current_date + timedelta(days=365*5),  # 5년 만료
                    last_charged_at=func.now()
                )
                db.add(token)
                db.commit()

        return user

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="내부 서버 오류가 발생했습니다."
        )

@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """특정 사용자의 상세 정보를 조회합니다."""
    try:
        user_detail = services.get_admin_user_detail(db, user_id)
        if not user_detail:
            raise HTTPException(status_code=404, detail="User not found")
        return user_detail
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error getting user detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/users/{user_id}", response_model=schemas.AdminUserResponse)
async def update_user_profile(
    user_id: str,
    user_update: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """관리자용 사용자 프로필 수정 API"""
    try:
        # 사용자 존재 여부 확인
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # WITHDRAWN 상태의 사용자는 수정 불가
        if user.status == 'WITHDRAWN':
            raise HTTPException(
                status_code=400,
                detail="Cannot update withdrawn user's profile"
            )

        # 닉네임 중복 체크
        if user_update.nickname and user_update.nickname != user.nickname:
            existing_user = db.query(User).filter(
                User.nickname == user_update.nickname,
                User.user_id != user_id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Nickname already exists"
                )

        # 전화번호 중복 체크
        if user_update.phone_number and user_update.phone_number != user.phone_number:
            existing_user = db.query(User).filter(
                User.phone_number == user_update.phone_number,
                User.user_id != user_id
            ).first()
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Phone number already exists"
                )

        # 업데이트할 필드 설정
        update_data = user_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_update: schemas.UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """사용자의 권한을 변경합니다."""
    try:
        updated_user = services.update_user_role(db, user_id, role_update.role)
        return {"message": "User role updated successfully", "user": updated_user}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating user role: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/users/{user_id}/status")
async def update_user_status(
        user_id: str,
        status_update: Dict[str, str] = Body(..., example={"status": "ACTIVE"}),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """
    사용자의 상태를 변경합니다.

    Parameters:
    - user_id: 변경할 사용자의 ID
    - status_update: 새로운 상태 정보 {'status': 'ACTIVE' | 'INACTIVE' | 'BANNED'}
    """
    try:
        if 'status' not in status_update:
            raise HTTPException(status_code=422, detail="Status field is required")

        updated_user = services.update_user_status(db, user_id, status_update['status'])
        return {"message": "User status updated successfully", "user": updated_user}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating user status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """사용자 계정을 비활성화합니다."""
    try:
        result = services.delete_user(db, user_id)
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User has been deactivated successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deactivating user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/banners", response_model=banner_schemas.Banner)
async def create_banner(
    image_file: UploadFile = File(..., description="Banner image file"),
    target_url: Optional[HttpUrl] = Form(None, description="URL to redirect when banner is clicked"),
    start_date: date = Form(..., description="Banner start date (YYYY-MM-DD)"),
    end_date: date = Form(..., description="Banner end date (YYYY-MM-DD)"),
    is_public: bool = Form(True, description="Whether the banner is public"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 생성

    - **image_file**: 배너 이미지 파일 (필수)
    - **target_url**: 배너 클릭 시 이동할 URL (선택, 없으면 클릭 시 아무 동작 없음)
    - **start_date**: 배너 시작 날짜 (YYYY-MM-DD 형식, 필수)
    - **end_date**: 배너 종료 날짜 (YYYY-MM-DD 형식, 필수)
    - **is_public**: 배너 공개 여부 (기본값: True)

    관리자 권한이 필요합니다.
    이미지 파일은 S3에 자동으로 업로드되며, 생성된 URL이 배너 정보에 저장됩니다.
    """
    banner_data = banner_schemas.BannerCreate(
        target_url=target_url,
        start_date=start_date,
        end_date=end_date,
        is_public=is_public
    )
    return banner_services.create_banner(db, banner_data, image_file)

@router.get("/banners", response_model=List[banner_schemas.Banner])
async def read_banners(
    skip: int = 0,
    limit: int = 100,
    is_public: bool = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 목록 조회

    - **skip**: 건너뛸 배너 수 (기본값: 0)
    - **limit**: 반환할 최대 배너 수 (기본값: 100)
    - **is_public**: 공개 여부로 필터링 (선택적)

    관리자 권한이 필요합니다.
    """
    banners = banner_services.get_banners(db, skip=skip, limit=limit, is_public=is_public)
    return banners

@router.get("/banners/{banner_id}", response_model=banner_schemas.Banner)
async def read_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    특정 배너 조회

    - **banner_id**: 조회할 배너의 ID

    관리자 권한이 필요합니다.
    """
    db_banner = banner_services.get_banner(db, banner_id=banner_id)
    if db_banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    return db_banner

@router.put("/banners/{banner_id}", response_model=banner_schemas.Banner)
async def update_banner(
    banner_id: int,
    banner: banner_schemas.BannerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 수정

    - **banner_id**: 수정할 배너의 ID
    - **banner**: 수정할 배너 정보

    관리자 권한이 필요합니다.
    수정하지 않을 필드는 요청 본문에서 생략 가능합니다.
    """
    db_banner = banner_services.update_banner(db, banner_id, banner)
    if db_banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    return db_banner

@router.delete("/banners/{banner_id}", status_code=204)
async def delete_banner(
    banner_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    배너 삭제

    - **banner_id**: 삭제할 배너의 ID

    관리자 권한이 필요합니다.
    배너 삭제 시 S3에 저장된 이미지 파일도 함께 삭제됩니다.
    """
    success = banner_services.delete_banner(db, banner_id)
    if not success:
        raise HTTPException(status_code=404, detail="Banner not found")
    return {"ok": True}

@router.post("/curators", response_model=curator_schemas.Curator)
async def create_curator(
    profile_image: UploadFile = File(...),
    name: str = Form(...),
    introduction: str = Form(...),
    category: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 생성

    - **name**: 큐레이터 이름 (필수)
    - **introduction**: 큐레이터 소개 (필수)
    - **category**: 전문 분야 (필수)
    - **profile_image**: 프로필 이미지 파일 (필수)

    관리자 권한이 필요합니다.
    """
    curator_data = curator_schemas.CuratorCreate(
        name=name,
        introduction=introduction,
        category=category
    )
    return await curator_services.create_curator(db, curator_data, profile_image)

@router.get("/curators", response_model=List[curator_schemas.Curator])
async def read_curators(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 목록 조회

    - **skip**: 건너뛸 큐레이터 수 (기본값: 0)
    - **limit**: 반환할 최대 큐레이터 수 (기본값: 100)

    관리자 권한이 필요합니다.
    """
    curators = curator_services.get_curators(db, skip=skip, limit=limit)
    return curators

@router.get("/curators/{curator_id}", response_model=curator_schemas.Curator)
async def read_curator(
    curator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    특정 큐레이터 조회

    - **curator_id**: 조회할 큐레이터의 ID

    관리자 권한이 필요합니다.
    """
    db_curator = curator_services.get_curator(db, curator_id=curator_id)
    if db_curator is None:
        raise HTTPException(status_code=404, detail="Curator not found")
    return db_curator

@router.put("/curators/{curator_id}", response_model=curator_schemas.Curator)
async def update_curator(
    curator_id: int,
    curator: curator_schemas.CuratorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 수정

    - **curator_id**: 수정할 큐레이터의 ID
    - **curator**: 수정할 큐레이터 정보

    관리자 권한이 필요합니다.
    수정하지 않을 필드는 요청 본문에서 생략 가능합니다.
    """
    db_curator = curator_services.update_curator(db, curator_id, curator)
    if db_curator is None:
        raise HTTPException(status_code=404, detail="Curator not found")
    return db_curator

@router.delete("/curators/{curator_id}", status_code=204)
async def delete_curator(
    curator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    큐레이터 삭제

    - **curator_id**: 삭제할 큐레이터의 ID

    관리자 권한이 필요합니다.
    """
    success = curator_services.delete_curator(db, curator_id)
    if not success:
        raise HTTPException(status_code=404, detail="Curator not found")
    return {"ok": True}

@router.get("/notifications", response_model=NotificationListResponse)
async def get_admin_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """관리자용 알림 목록 조회"""
    try:
        notifications, total_count = services.get_admin_notifications(
            db=db,
            page=page,
            limit=limit,
            search=search
        )
        return {
            "notifications": notifications,
            "total_count": total_count,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notifications", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,  # NotificationCreate 스키마 사용
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """새로운 알림 생성"""
    try:
        created_notification = services.create_notification(
            db=db,
            notification_data=notification
        )
        return created_notification
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/notifications/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """알림 삭제"""
    if not services.delete_notification(db, notification_id):
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """알림 읽음 처리"""
    if not services.mark_notification_as_read(db, notification_id, current_user.user_id):
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    return {"status": "success"}

@router.get("/notifications/{notification_id}/read-status")
def get_notification_read_status(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """알림의 읽음 상태 상세 정보를 조회합니다."""
    try:
        status_details = services.get_notification_read_status(db, notification_id)
        return {
            "status_details": status_details
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="읽음 상태 조회에 실패했습니다")

@router.put("/notices/{notice_id}/image", response_model=schemas.AdminNoticeResponse)
async def update_notice_image(
        notice_id: int,
        image_file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """공지사항 이미지 업데이트 API"""
    try:
        notice = services.get_admin_notice(db, notice_id)
        if not notice:
            raise HTTPException(status_code=404, detail="Notice not found")

        file_extension = image_file.filename.split('.')[-1]
        object_name = f"notices/{uuid.uuid4()}.{file_extension}"

        if upload_file_to_s3(image_file.file, settings.S3_BUCKET_NAME, object_name):
            image_url = get_cloudfront_url(object_name)
            update_data = {"image_url": image_url}
            updated_notice = services.update_admin_notice(db, notice_id, update_data)
            return updated_notice
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notices", response_model=schemas.AdminNoticeResponse)
async def create_notice(
        title: str = Form(...),
        content: str = Form(...),
        start_date: date = Form(...),
        end_date: date = Form(...),
        is_public: bool = Form(True),
        is_important: bool = Form(False),
        image_file: Optional[UploadFile] = File(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자용 공지사항 생성 API"""
    try:
        image_url = None
        if image_file:
            file_extension = image_file.filename.split('.')[-1]
            object_name = f"notices/{uuid.uuid4()}.{file_extension}"
            if upload_file_to_s3(image_file.file, settings.S3_BUCKET_NAME, object_name):
                image_url = get_cloudfront_url(object_name)

        notice_data = {
            "title": title,
            "content": content,
            "start_date": start_date,
            "end_date": end_date,
            "is_public": is_public,
            "is_important": is_important,
            "image_url": image_url
        }
        notice = services.create_notice(db, notice_data)
        return notice
    except Exception as e:
        logger.error(f"Error creating notice: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create notice")


@router.get("/notices", response_model=List[schemas.AdminNoticeResponse])
async def list_notices(
        page: int = Query(1, ge=1),
        limit: int = Query(10, ge=1, le=100),
        search: Optional[str] = None,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자용 공지사항 목록 조회 API"""
    try:
        result = services.get_admin_notices(
            db=db,
            page=page,
            limit=limit,
            search=search
        )
        return result
    except Exception as e:
        logger.error(f"Error getting notices: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get notices")


@router.get("/notices/{notice_id}", response_model=schemas.AdminNoticeDetail)
async def get_notice(
        notice_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자용 공지사항 상세 조회 API"""
    notice = services.get_admin_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


@router.put("/notices/{notice_id}", response_model=schemas.AdminNoticeResponse)
async def update_notice(
    notice_id: int,
    notice_update: schemas.AdminNoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    try:
        notice = services.get_admin_notice(db, notice_id)
        if not notice:
            raise HTTPException(status_code=404, detail="Notice not found")

        update_data = notice_update.dict(exclude_unset=True)
        updated_notice = services.update_admin_notice(db, notice_id, update_data)
        return updated_notice
    except Exception as e:
        logger.error(f"Error updating notice: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update notice")


@router.delete("/notices/{notice_id}")
async def delete_notice(
        notice_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_admin_user)
):
    """관리자용 공지사항 삭제 API"""
    notice = services.get_admin_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    services.delete_admin_notice(db, notice_id)
    return {"message": "Notice deleted successfully"}




@router.get("/settings/welcome-tokens", response_model=WelcomeTokenResponse)
async def get_welcome_tokens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """가입 축하 스톤 설정을 조회합니다."""
    try:
        result = services.get_welcome_tokens(db)
        return result
    except Exception as e:
        logger.error(f"Error getting welcome tokens: {str(e)}")
        raise HTTPException(status_code=500, detail="가입 축하 스톤 설정 조회에 실패했습니다.")

@router.post("/settings/welcome-tokens", response_model=WelcomeTokenResponse)
async def update_welcome_tokens(
    welcome_tokens: WelcomeTokenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """가입 축하 스톤 설정을 업데이트합니다."""
    try:
        result = services.update_welcome_tokens(db, welcome_tokens.welcome_tokens)
        return result
    except Exception as e:
        logger.error(f"Error updating welcome tokens: {str(e)}")
        raise HTTPException(status_code=500, detail="가입 축하 스톤 설정 업데이트에 실패했습니다.")

@router.post("/users/grant-tokens", response_model=TokenGrantResponse)
async def grant_tokens(
    grant_data: TokenGrantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """특정 사용자에게 스톤을 지급합니다."""
    try:
        result = services.grant_tokens_to_user(
            db,
            grant_data.email,
            grant_data.amount,
            grant_data.reason,
            current_user.user_id
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error granting tokens: {str(e)}")
        raise HTTPException(status_code=500, detail="스톤 지급에 실패했습니다.")

@router.put("/subscription-plans/{plan_id}")
async def update_subscription_plan(
    plan_id: int,
    plan_update: SubscriptionPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """구독 상품을 수정합니다."""
    try:
        updated_plan = services.update_subscription_plan(db, plan_id, plan_update)
        return updated_plan
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating subscription plan: {str(e)}")
        raise HTTPException(status_code=500, detail="상품 수정에 실패했습니다.")

@router.put("/token-plans/{plan_id}")
async def update_token_plan(
    plan_id: int,
    plan_update: TokenPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """일반 상품을 수정합니다."""
    try:
        updated_plan = services.update_token_plan(db, plan_id, plan_update)
        return updated_plan
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating token plan: {str(e)}")
        raise HTTPException(status_code=500, detail="상품 수정에 실패했습니다.")
    
@router.get("/token-grants")
async def list_token_grants(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """토큰 지급 이력을 조회합니다."""
    try:
        result = services.get_token_grants(
            db=db,
            page=page,
            limit=limit,
            search=search
        )
        return result
    except Exception as e:
        logger.error(f"Error getting token grants: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get token grants")