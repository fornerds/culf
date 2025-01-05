from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class InquiryStatus(str, enum.Enum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"

class Inquiry(Base):
    __tablename__ = "inquiries"

    inquiry_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    contact = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    attachments = Column(JSONB, nullable=True, default=None)
    status = Column(
        ENUM('PENDING', 'RESOLVED', name='inquiry_status'),
        nullable=False,
        default='PENDING'
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="inquiries")
    refunds = relationship("Refund", back_populates="inquiry", lazy="dynamic")