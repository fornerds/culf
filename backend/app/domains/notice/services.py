from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from . import models, schemas
from typing import List, Optional, Tuple
from uuid import UUID
from datetime import datetime, date


def get_notices(
        db: Session,
        skip: int = 0,
        limit: int = 10,
        user_id: Optional[UUID] = None,
        include_private: bool = False
) -> Tuple[List[models.Notice], int]:
    query = db.query(models.Notice)

    if not include_private:
        # 공개된 공지사항만 조회
        query = query.filter(models.Notice.is_public == True)

        # 현재 유효한 기간의 공지사항만 조회
        today = date.today()
        query = query.filter(
            and_(
                models.Notice.start_date <= today,
                models.Notice.end_date >= today
            )
        )

    # 중요 공지를 우선 정렬하고, 그 다음 생성일시로 정렬
    query = query.order_by(
        models.Notice.is_important.desc(),  # 중요 공지 우선
        models.Notice.created_at.desc()
    )

    total = query.count()
    notices = query.offset(skip).limit(limit).all()

    # 읽음 상태 확인
    if user_id:
        for notice in notices:
            read_status = db.query(models.UserNoticeRead).filter(
                models.UserNoticeRead.notice_id == notice.notice_id,
                models.UserNoticeRead.user_id == user_id
            ).first()
            notice.is_read = bool(read_status and read_status.is_read)

    return notices, total


def get_notice(
        db: Session,
        notice_id: int,
        increment_view: bool = True
) -> Optional[models.Notice]:
    notice = db.query(models.Notice).filter(models.Notice.notice_id == notice_id).first()

    if notice and increment_view:
        notice.view_count += 1
        db.commit()
        db.refresh(notice)

    return notice


def create_notice(db: Session, notice: schemas.NoticeCreate) -> models.Notice:
    """공지사항을 생성합니다."""
    try:
        db_notice = models.Notice(
            title=notice.title,
            content=notice.content,
            image_url=notice.image_url,
            start_date=notice.start_date,
            end_date=notice.end_date,
            is_public=notice.is_public,
            is_important=notice.is_important,
            view_count=0
        )
        db.add(db_notice)
        db.commit()
        db.refresh(db_notice)
        return db_notice
    except Exception as e:
        db.rollback()
        raise ValueError(f"공지사항 생성 중 오류가 발생했습니다: {str(e)}")


def update_notice(
        db: Session,
        notice_id: int,
        notice_update: schemas.NoticeUpdate
) -> Optional[models.Notice]:
    db_notice = get_notice(db, notice_id, increment_view=False)
    if not db_notice:
        return None

    update_data = notice_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_notice, field, value)

    db.add(db_notice)
    db.commit()
    db.refresh(db_notice)
    return db_notice


def delete_notice(db: Session, notice_id: int) -> bool:
    try:
        # 먼저 user_notice_reads 테이블에서 관련 레코드 삭제
        db.query(models.UserNoticeRead).filter(
            models.UserNoticeRead.notice_id == notice_id
        ).delete()

        # 그 다음 notices 테이블에서 공지사항 삭제
        result = db.query(models.Notice).filter(
            models.Notice.notice_id == notice_id
        ).delete()

        db.commit()
        return result > 0
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete notice"
        )


def mark_notice_as_read(
        db: Session,
        user_id: UUID,
        notice_id: int
) -> models.UserNoticeRead:
    read_status = (
        db.query(models.UserNoticeRead)
        .filter(
            models.UserNoticeRead.notice_id == notice_id,
            models.UserNoticeRead.user_id == user_id
        )
        .first()
    )

    if not read_status:
        read_status = models.UserNoticeRead(
            user_id=user_id,
            notice_id=notice_id,
            is_read=True,
            read_at=datetime.now()
        )
        db.add(read_status)
        db.commit()
        db.refresh(read_status)

    return read_status