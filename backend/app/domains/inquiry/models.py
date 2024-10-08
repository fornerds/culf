from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Inquiry(Base):
    __tablename__ = "inquiries"

    inquiry_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    title = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    contact = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    attachments = Column(Text)
    status = Column(Enum('RECEIVED', 'IN_PROGRESS', 'COMPLETED', name='inquiry_status'), default='RECEIVED')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="inquiries")