from pydantic import BaseModel, Field, HttpUrl, validator
from typing import List, Optional
from datetime import datetime, date
from uuid import UUID

class NoticeBase(BaseModel):
    title: str = Field(..., example="시스템 점검 안내", description="공지사항 제목")
    content: str = Field(..., example="2024년 1월 1일 새벽 2시부터 4시까지 시스템 점검이 있을 예정입니다.", description="공지사항 내용")
    image_url: Optional[str] = Field(None, example="https://example.com/images/notice.jpg", description="공지사항 이미지 URL")
    start_date: date = Field(None, example="2024-01-01", description="공지사항 시작일")
    end_date: date = Field(..., example="2024-01-31", description="공지사항 종료일")
    is_public: bool = Field(True, description="공개 여부")
    is_important: Optional[bool] = Field(None, description="중요 공지 여부")

    @validator('end_date')
    def validate_dates(cls, end_date, values):
        if 'start_date' in values and end_date < values['start_date']:
            raise ValueError("종료일은 시작일보다 이후여야 합니다.")
        return end_date

class NoticeCreate(NoticeBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "시스템 점검 안내",
                "content": "2024년 1월 1일 새벽 2시부터 4시까지 시스템 점검이 있을 예정입니다.",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "is_important": False
            }
        }
    }


class NoticeUpdate(BaseModel):
    title: Optional[str] = Field(None, example="수정된 시스템 점검 안내")
    content: Optional[str] = Field(None, example="수정된 점검 일정입니다.")
    image_url: Optional[str] = Field(None, example="https://example.com/images/updated-notice.jpg")
    start_date: Optional[date] = Field(None, example="2024-01-01")
    end_date: Optional[date] = Field(None, example="2024-01-31")
    is_public: Optional[bool] = Field(None)
    is_important: Optional[bool] = Field(None)

class NoticeDetail(NoticeBase):
    notice_id: int
    view_count: int
    created_at: datetime
    updated_at: datetime
    is_read: bool = False

    class Config:
        from_attributes = True

class NoticeList(BaseModel):
    notices: List[NoticeDetail]
    total_count: int
    page: int
    limit: int

class UserNoticeRead(BaseModel):
    user_id: UUID
    notice_id: int
    is_read: bool
    read_at: datetime

    class Config:
        from_attributes = True