from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID
from app.domains.curator.schemas import Curator

class ChatRoomCreate(BaseModel):
    curator_id: int
    title: Optional[str] = None


class ChatRoomResponse(BaseModel):
    room_id: UUID
    curator_id: int
    curator: Curator  # 큐레이터 정보 포함
    title: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRoomDetail(ChatRoomResponse):
    updated_at: Optional[datetime]
    conversation_count: int
    last_conversation: Optional[dict]

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    question: str
    question_image: Optional[str] = None
    room_id: Optional[UUID] = None

    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "question": "What's in this image?",
                "question_image": "/v1/images/example.png",
                "room_id": None
            }
        }

class ConversationResponse(BaseModel):
    conversation_id: UUID
    answer: str
    tokens_used: int

class ConversationSummary(BaseModel):
    """대화 요약 정보를 위한 스키마"""
    conversation_id: UUID
    question_summary: str
    answer_summary: str
    question_time: datetime

    class Config:
        from_attributes = True  # SQLAlchemy 모델과의 호환성을 위한 설정

class ConversationDetail(BaseModel):
    """대화 상세 정보를 위한 스키마"""
    conversation_id: UUID
    user_id: UUID
    question: str
    question_image: Optional[str]
    answer: str
    question_time: datetime
    answer_time: datetime
    tokens_used: int

    class Config:
        from_attributes = True

class ConversationList(BaseModel):
    """대화 목록 응답을 위한 스키마"""
    conversations: List[Union[ConversationSummary, ConversationDetail]]
    total_count: int

    class Config:
        from_attributes = True