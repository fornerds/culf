from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class AttachmentInfo(BaseModel):
    file_name: str = Field(..., description="파일 이름")
    file_type: str = Field(..., description="파일 타입 (MIME type)")
    file_url: str = Field(..., description="파일 URL")

class InquiryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="문의 제목")
    email: EmailStr = Field(..., description="답변 받을 이메일")
    contact: str = Field(..., min_length=1, max_length=20, description="연락처")
    content: str = Field(..., min_length=1, description="문의 내용")
    attachments: Optional[List[AttachmentInfo]] = Field(default=None, description="첨부 파일 목록")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "서비스 이용 문의",
                "email": "user@example.com",
                "contact": "010-1234-5678",
                "content": "서비스 이용에 대해 문의드립니다.",
                "attachments": [
                    {
                        "file_name": "screenshot.png",
                        "file_type": "image/png",
                        "file_url": "https://example.com/files/screenshot.png"
                    }
                ]
            }
        }

class InquiryResponse(BaseModel):
    inquiry_id: str = Field(..., description="문의 ID")
    status: str = Field(..., description="문의 상태")
    message: str = Field(..., description="응답 메시지")

    class Config:
        json_schema_extra = {
            "example": {
                "inquiry_id": "123",
                "status": "RECEIVED",
                "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다."
            }
        }