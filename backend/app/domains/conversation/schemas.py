from pydantic import BaseModel, HttpUrl, Field, validator
from typing import List, Optional, Union, Dict, Any
from datetime import datetime
from uuid import UUID
from app.domains.curator.schemas import Curator

class ChatRoomCreate(BaseModel):
    curator_id: int
    title: Optional[str] = None


class ChatRoomResponse(BaseModel):
    room_id: UUID
    curator_id: int
    curator: Curator
    title: Optional[str]
    conversations: Optional[List[dict]] = Field(alias='conversations_response')
    conversation_count: Optional[int] = 0
    last_conversation: Optional[dict] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ConversationInRoom(BaseModel):
    """채팅방 내 대화 정보를 위한 스키마"""
    question: str
    answer: str
    question_time: datetime
    answer_time: Optional[datetime]
    question_images: Optional[List[str]] = None

    class Config:
        from_attributes = True

class ChatRoomDetail(BaseModel):
    room_id: UUID
    title: str
    curator_id: int
    curator: Optional[Curator]
    conversations: List[ConversationInRoom]
    conversation_count: int
    last_conversation: Optional[Dict]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    question: Optional[str] = None
    question_images: Optional[List[str]] = None  # URL 문자열 배열로 변경
    room_id: Optional[UUID] = Field(
        None,
        example="b39190ce-a097-4965-bf20-13100cb0420d"
    )
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "question": "What's in these images?",
                "question_images": [
                    "https://d21y711itn1wuo.cloudfront.net/chat_images/a6dcf61a-6ffe-45ba-8ad0-cc97269408df.jpg",
                    "https://d21y711itn1wuo.cloudfront.net/chat_images/a5dcf61a-6ffe-45ba-8ad0-cc97269408df.jpg"
                ],
                "room_id": "b39190ce-a097-4965-bf20-13100cb0420d"
            }
        }

class ConversationResponse(BaseModel):
    conversation_id: UUID
    answer: str
    tokens_used: int
    images: Optional[List[str]] = None
    recommended_questions: List[str] = Field(
        default_factory=list,
        max_items=3,
        description="3 recommended follow-up questions"
    )

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
    question_images: Optional[List[str]] = None
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

class ChatRoomCuratorResponse(BaseModel):
    """채팅방의 큐레이터 정보 응답을 위한 스키마"""
    room_id: UUID
    curator: Curator

    class Config:
        from_attributes = True

class ChatRoomListItem(BaseModel):
    """채팅방 목록 조회를 위한 스키마"""
    room_id: UUID
    title: str
    curator_id: int
    curator: Optional[Curator]
    conversation_count: int
    last_conversation: Optional[dict]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class AdminConversationListResponse(BaseModel):
    conversations: List[dict]
    total_count: int

    class Config:
        from_attributes = True