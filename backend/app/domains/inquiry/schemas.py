from pydantic import BaseModel, EmailStr, Field, HttpUrl
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID

class AttachmentInfo(BaseModel):
    file_name: str = Field(..., description="파일 이름")
    file_type: str = Field(..., description="파일 타입 (MIME type)")
    file_url: str = Field(..., description="파일 URL")

class InquiryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="문의 제목")
    email: str = Field(..., description="답변 받을 이메일")
    contact: str = Field(..., min_length=1, max_length=20, description="연락처")
    content: str = Field(..., min_length=1, description="문의 내용")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "서비스 이용 문의",
                "email": "user@example.com",
                "contact": "010-1234-5678",
                "content": "서비스 이용에 대해 문의드립니다.",
                "attachments": [
                    "https://example.com/files/screenshot1.png",
                    "https://example.com/files/screenshot2.png"
                ]
            }
        }

class InquiryResponse(BaseModel):
    inquiry_id: int = Field(..., description="문의 ID")
    status: str = Field(..., description="문의 상태")
    message: str = Field(..., description="응답 메시지")

    class Config:
        json_schema_extra = {
            "example": {
                "inquiry_id": 123,
                "status": "RECEIVED",
                "message": "문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다."
            }
        }

class UserInfo(BaseModel):
    user_id: UUID
    email: str
    phone_number: Optional[str]
    nickname: str

    class Config:
        from_attributes = True

class InquiryDetail(BaseModel):
    inquiry_id: int
    user_id: Optional[UUID] = None
    type: str
    title: str
    email: str
    contact: str
    content: str
    attachments: Optional[List[str]] = None
    status: str
    created_at: datetime
    user: Optional[UserInfo] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "inquiry_id": 123,
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "type": "GENERAL",
                "title": "서비스 이용 문의",
                "email": "user@example.com",
                "contact": "010-1234-5678",
                "content": "서비스 이용에 대해 문의드립니다.",
                "attachments": [
                    "https://example.com/files/screenshot1.png",
                    "https://example.com/files/screenshot2.png"
                ],
                "status": "PENDING",
                "created_at": "2024-01-01T00:00:00Z"
            }
        }