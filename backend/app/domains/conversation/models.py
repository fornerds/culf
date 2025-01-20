from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

# 상수 정의
CHAT_TOKEN_COST = 1  # 채팅 1회당 사용되는 스톤 수
class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    room_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    curator_id = Column(Integer, ForeignKey('curators.curator_id'), nullable=False)
    title = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 스톤 사용량 관련 필드 추가
    total_tokens_used = Column(Integer, default=0)  # 총 사용된 스톤 수
    conversation_count = Column(Integer, default=0)  # 총 대화 수
    average_tokens_per_conversation = Column(Float, default=0.0)  # 대화당 평균 스톤 수
    last_token_update = Column(DateTime(timezone=True))  # 마지막 스톤 업데이트 시간

    user = relationship("User", back_populates="chat_rooms")
    curator = relationship("Curator")
    conversations = relationship(
        "Conversation",
        back_populates="chat_room",
        order_by="asc(Conversation.question_time)"
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._last_conversation = None
        self._conversations_list = []

    @property
    def last_conversation(self):
        return getattr(self, '_last_conversation', None)

    @property
    def conversations_response(self):
        return getattr(self, '_conversations_list', [])

    def update_token_stats(self, tokens_used: int):
        """대화방의 스톤 통계를 업데이트합니다."""
        self.total_tokens_used += tokens_used
        self.conversation_count += 1
        if self.conversation_count > 0:
            self.average_tokens_per_conversation = round(self.total_tokens_used / self.conversation_count, 2)
        self.last_token_update = func.now()

class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey('chat_rooms.room_id'), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    question = Column(Text, nullable=False)
    question_summary = Column(String(255), nullable=True)
    question_images = Column(JSONB, nullable=True)
    answer = Column(Text, nullable=False)
    answer_summary = Column(String(255), nullable=True)
    question_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    answer_time = Column(DateTime(timezone=True))
    tokens_used = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="conversations")
    chat_room = relationship("ChatRoom", back_populates="conversations")