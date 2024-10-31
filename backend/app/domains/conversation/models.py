from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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