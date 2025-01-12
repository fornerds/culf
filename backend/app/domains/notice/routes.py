from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_superuser, get_current_active_user, get_current_user
from app.domains.user.models import User
from . import schemas, services
from datetime import date, timedelta
from fastapi.responses import JSONResponse
router = APIRouter()


@router.get(
    "/notices",
    response_model=schemas.NoticeList,
    summary="공지사항 목록 조회",
    description="""
    공지사항 목록을 페이지네이션하여 조회합니다.

    - 중요 공지는 상단에 고정됩니다
    - 읽음 여부가 표시됩니다
    - 페이지네이션을 지원합니다
    """,
)
async def get_notices(
        page: int = Query(1, ge=1, description="페이지 번호"),
        limit: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
        current_user: Optional[User] = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> schemas.NoticeList:
    user_id = current_user.user_id if current_user else None
    notices, total = services.get_notices(
        db,
        skip=(page - 1) * limit,
        limit=limit,
        user_id=user_id
    )
    return {
        "notices": notices,
        "total_count": total,
        "page": page,
        "limit": limit
    }


@router.get(
    "/notices/{notice_id}",
    response_model=schemas.NoticeDetail,
    summary="공지사항 상세 조회",
    description="특정 공지사항의 상세 내용을 조회합니다.",
)
async def get_notice(
        notice_id: int = Path(..., description="조회할 공지사항 ID"),
        current_user: Optional[User] = Depends(get_current_user),
        db: Session = Depends(get_db)
) -> schemas.NoticeDetail:
    notice = services.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    # 로그인한 사용자인 경우에만 읽음 상태 처리
    if current_user:
        services.mark_notice_as_read(db, current_user.user_id, notice_id)
    return notice


@router.post(
    "/admin/notices",
    response_model=schemas.NoticeDetail,
    summary="공지사항 생성",
    description="""새로운 공지사항을 생성합니다. (관리자 전용)

    필수 필드:
    - title: 공지사항 제목
    - content: 공지사항 내용
    - start_date: 공지 시작일 (YYYY-MM-DD)
    - end_date: 공지 종료일 (YYYY-MM-DD)

    선택 필드:
    - image_url: 이미지 URL
    - is_public: 공개 여부 (기본값: true)
    - is_important: 중요 공지 여부 (기본값: false)
    """,
)
async def create_notice(
        notice: schemas.NoticeCreate = Body(
            ...,
            example={
                "title": "시스템 점검 안내",
                "content": "2024년 1월 1일 새벽 2시부터 4시까지 시스템 점검이 있을 예정입니다.",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "is_public": True,
                "is_important": False
            }
        ),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_superuser)
):
    """
    공지사항을 생성합니다.
    """
    try:
        # start_date가 없으면 오늘 날짜를 기본값으로 사용
        if not notice.start_date:
            notice.start_date = date.today()

        # end_date가 없으면 30일 후를 기본값으로 사용
        if not notice.end_date:
            notice.end_date = date.today() + timedelta(days=30)

        # 날짜 유효성 검사
        if notice.end_date < notice.start_date:
            raise HTTPException(
                status_code=400,
                detail="종료일은 시작일보다 이후여야 합니다."
            )

        result = services.create_notice(db, notice)
        return result

    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"detail": str(e)}
        )
@router.put(
    "/admin/notices/{notice_id}",
    response_model=schemas.NoticeDetail,
    summary="공지사항 수정",
    description="기존 공지사항을 수정합니다. (관리자 전용)",
)
async def update_notice(
        notice_id: int = Path(..., description="수정할 공지사항 ID"),
        notice_update: schemas.NoticeUpdate = None,
        current_user: User = Depends(get_current_active_superuser),
        db: Session = Depends(get_db)
) -> schemas.NoticeDetail:
    db_notice = services.get_notice(db, notice_id)
    if not db_notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    return services.update_notice(db, notice_id, notice_update)


@router.delete(
    "/admin/notices/{notice_id}",
    status_code=204,
    summary="공지사항 삭제",
    description="공지사항을 삭제합니다. (관리자 전용)",
)
async def delete_notice(
        notice_id: int = Path(..., description="삭제할 공지사항 ID"),
        current_user: User = Depends(get_current_active_superuser),
        db: Session = Depends(get_db)
):
    if not services.delete_notice(db, notice_id):
        raise HTTPException(status_code=404, detail="Notice not found")
    return {"status": "success"}