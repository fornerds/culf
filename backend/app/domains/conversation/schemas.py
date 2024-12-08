from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union
from datetime import datetime
from uuid import UUID

class ConversationCreate(BaseModel):
    question: str
    question_image: Optional[str] = None

    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "question": "What's in this image?",
                "question_image": "/v1/images/example.png"
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