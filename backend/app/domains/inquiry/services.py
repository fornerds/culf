from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.domains.user import schemas as user_schemas
from app.utils.s3_client import upload_file_to_s3
from . import schemas, services
import logging
import uuid
from app.core.config import settings

router = APIRouter()

@router.post("/inquiries", response_model=schemas.InquiryResponse)
async def create_inquiry(
        title: str = Form(..., description="문의 제목"),
        email: str = Form(..., description="연락받을 이메일"),
        contact: str = Form(..., description="연락처"),
        content: str = Form(..., description="문의 내용"),
        attachments: Optional[UploadFile] = File(default=None, description="첨부파일 (선택)"),
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    문의사항을 생성합니다.
    """
    try:
        # Process attachment if any
        attachment_info = None
        if attachments:
            try:
                file_extension = attachments.filename.split('.')[-1]
                object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

                file_url = upload_file_to_s3(attachments.file, settings.S3_BUCKET_NAME, object_name)
                if not file_url:
                    raise HTTPException(
                        status_code=500,
                        detail={
                            "error": "file_upload_failed",
                            "message": "파일 업로드에 실패했습니다."
                        }
                    )

                attachment_info = schemas.AttachmentInfo(
                    file_name=attachments.filename,
                    file_type=attachments.content_type,
                    file_url=file_url
                )
            except Exception as e:
                logging.error(f"File upload error: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "file_upload_failed",
                        "message": "파일 업로드에 실패했습니다."
                    }
                )

        # Create inquiry object
        inquiry_data = schemas.InquiryCreate(
            title=title,
            email=email,
            contact=contact,
            content=content,
            attachments=[attachment_info] if attachment_info else None
        )

        # Save inquiry to database
        db_inquiry = services.create_inquiry(db, inquiry_data, current_user.user_id)

        return {
            "inquiry_id": str(db_inquiry.inquiry_id),
            "status": "RECEIVED",
            "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다."
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