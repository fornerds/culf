from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.core.deps import get_current_active_user, get_current_admin_user
from app.domains.user import schemas as user_schemas
from app.utils.s3_client import upload_file_to_s3
from app.utils.cloudfront_utils import get_cloudfront_url
from app.core.config import settings
from . import schemas, services
import logging
import uuid

router = APIRouter()


@router.post("/inquiries", response_model=schemas.InquiryResponse)
async def create_inquiry(
        title: str = Form(...),
        email: str = Form(...),
        contact: str = Form(...),
        content: str = Form(...),
        attachments: List[UploadFile] = File(None),
        db: Session = Depends(get_db)
):
    """문의사항 생성 API"""
    try:
        # 첨부파일 처리
        attachment_urls = []
        if attachments:
            for file in attachments:
                # 파일 형식 검증
                content_type = file.content_type.lower()
                if content_type not in ["image/jpeg", "image/jpg", "image/png", "image/gif"]:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "invalid_file_type",
                            "message": f"지원하지 않는 파일 형식입니다. ({file.filename})"
                        }
                    )

                # S3에 업로드
                file_extension = file.filename.split('.')[-1].lower()
                object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

                if upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name):
                    file_url = get_cloudfront_url(object_name)
                    attachment_urls.append(file_url)

        # 문의사항 데이터 생성
        inquiry_data = {
            "title": title,
            "email": email,
            "contact": contact,
            "content": content,
            "attachments": attachment_urls if attachment_urls else None
        }

        # 문의사항 저장
        inquiry = services.create_inquiry(db, inquiry_data)

        return {
            "inquiry_id": inquiry.inquiry_id,
            "status": "PENDING",
            "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다."
        }

    except Exception as e:
        logging.error(f"Inquiry creation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "inquiry_submission_failed",
                "message": "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요."
            }
        )

@router.get("/inquiries/me", response_model=List[schemas.InquiryDetail])
def read_my_inquiries(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """사용자 본인의 문의사항 목록 조회"""
    inquiries = services.get_user_inquiries(db, current_user.user_id, skip, limit)
    return inquiries


@router.get("/inquiries/{inquiry_id}", response_model=schemas.InquiryDetail)
def read_inquiry(
        inquiry_id: int,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """특정 문의사항 상세 조회"""
    inquiry = services.get_inquiry(db, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inquiry.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this inquiry")
    return inquiry


@router.get("/admin/inquiries", response_model=List[schemas.InquiryDetail])
def read_all_inquiries(
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_admin_user)
):
    """관리자용 전체 문의사항 목록 조회"""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")

    inquiries = services.get_admin_inquiries(
        db,
        skip=skip,
        limit=limit,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

    for inquiry in inquiries:
        if inquiry.attachments == 'null':
            inquiry.attachments = None

    return inquiries

@router.get("/admin/inquiries/{inquiry_id}", response_model=schemas.InquiryDetail)
async def read_admin_inquiry(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_admin_user)
):
    """관리자용 문의사항 상세 조회"""
    inquiry = services.get_inquiry(db, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry

@router.put("/admin/inquiries/{inquiry_id}/status", response_model=schemas.InquiryDetail)
def update_inquiry_status(
    inquiry_id: int,
    status: str = Body(..., embed=True),  # Body 파라미터로 변경
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_admin_user)
):
    """관리자용 문의사항 상태 업데이트"""
    inquiry = services.update_inquiry_status(db, inquiry_id, status)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry