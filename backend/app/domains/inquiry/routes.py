from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db.session import get_db
from app.core.deps import get_current_active_user
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
        title: str = Form(..., description="문의 제목"),
        email: str = Form(..., description="연락받을 이메일"),
        contact: str = Form(..., description="연락처"),
        content: str = Form(..., description="문의 내용"),
        attachments: List[UploadFile] = File(None, description="첨부파일 (여러 개 가능)"),
        db: Session = Depends(get_db)
):
    """
    문의사항 생성 API

    - attachments: 여러 개의 이미지 파일을 전송할 수 있습니다.
    - 지원 형식: jpg, jpeg, png, gif
    - 각 파일 최대 크기: 10MB

    반환 예시:
    ```json
    {
        "inquiry_id": 123,
        "status": "PENDING",
        "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다.",
        "attachments": {
            "files": [
                {
                    "file_name": "image1.jpg",
                    "file_type": "image/jpeg",
                    "file_url": "https://example.com/files/image1.jpg"
                },
                {
                    "file_name": "image2.png",
                    "file_type": "image/png",
                    "file_url": "https://example.com/files/image2.png"
                }
            ]
        }
    }
    ```
    """
    try:
        # 파일 크기 및 형식 검증
        if attachments:
            for file in attachments:
                if file.size > 10 * 1024 * 1024:  # 10MB 제한
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "file_too_large",
                            "message": f"파일 크기는 10MB를 초과할 수 없습니다. ({file.filename})"
                        }
                    )

                content_type = file.content_type.lower()
                if content_type not in ["image/jpeg", "image/jpg", "image/png", "image/gif"]:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "invalid_file_type",
                            "message": f"지원하지 않는 파일 형식입니다. ({file.filename})"
                        }
                    )

        # 첨부파일 처리
        attachment_info = []
        if attachments:
            for file in attachments:
                file_extension = file.filename.split('.')[-1].lower()
                object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

                if upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name):
                    image_url = get_cloudfront_url(object_name)
                    attachment_info.append({
                        "file_name": file.filename,
                        "file_type": file.content_type,
                        "file_url": image_url
                    })

        # 문의사항 데이터 생성
        inquiry_data = schemas.InquiryCreate(
            title=title,
            email=email,
            contact=contact,
            content=content,
            attachments={"files": attachment_info} if attachment_info else None
        )

        # 문의사항 저장
        inquiry = services.create_inquiry(db, inquiry_data)

        return {
            "inquiry_id": inquiry.inquiry_id,
            "status": "PENDING",
            "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다.",
            "attachments": inquiry.attachments
        }

    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "validation_error",
                "message": str(ve)
            }
        )
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
        current_user: user_schemas.User = Depends(get_current_active_user)
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


@router.put("/admin/inquiries/{inquiry_id}/status", response_model=schemas.InquiryDetail)
def update_inquiry_status(
        inquiry_id: int,
        status: str,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """관리자용 문의사항 상태 업데이트"""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")

    inquiry = services.update_inquiry_status(db, inquiry_id, status)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return inquiry