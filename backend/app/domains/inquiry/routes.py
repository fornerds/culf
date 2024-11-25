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

router = APIRouter()


@router.post("/inquiries", response_model=schemas.InquiryResponse)
async def create_inquiry(
        title: str = Form(...),
        email: str = Form(...),
        contact: str = Form(...),
        content: str = Form(...),
        attachments: List[UploadFile] = File(None),
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """
    Create a new inquiry with optional file attachments
    """
    try:
        # Process attachments if any
        attachment_info = []
        if attachments:
            for file in attachments:
                try:
                    # Generate unique file name
                    file_extension = file.filename.split('.')[-1]
                    object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

                    # Upload file to S3
                    file_url = upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name)
                    if not file_url:
                        raise HTTPException(status_code=500, detail="Failed to upload file")

                    attachment_info.append(schemas.AttachmentInfo(
                        file_name=file.filename,
                        file_type=file.content_type,
                        file_url=file_url
                    ))
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
            attachments=attachment_info
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