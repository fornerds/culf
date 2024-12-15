from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    room_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    curator_id = Column(Integer, ForeignKey('curators.curator_id'), nullable=False)
    title = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_rooms")
    curator = relationship("Curator")
    conversations = relationship("Conversation", back_populates="chat_room")


    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._conversation_count = 0
        self._last_conversation = None
        self._conversations_list = []

    @property
    def conversation_count(self):
        return getattr(self, '_conversation_count', 0)

    @property
    def last_conversation(self):
        return getattr(self, '_last_conversation', None)

    @property
    def conversations_response(self):
        return getattr(self, '_conversations_list', [])

class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey('chat_rooms.room_id'), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    question = Column(Text, nullable=False)
    question_summary = Column(String(255), nullable=True)
    question_image = Column(String(255), nullable=True)
    answer = Column(Text, nullable=False)
    answer_summary = Column(String(255), nullable=True)
    question_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    answer_time = Column(DateTime(timezone=True))
    tokens_used = Column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="conversations")
    chat_room = relationship("ChatRoom", back_populates="conversations")