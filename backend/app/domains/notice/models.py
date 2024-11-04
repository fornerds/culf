from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Notice(Base):
    __tablename__ = "notices"

    notice_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    view_count = Column(Integer, nullable=False, default=0)
    is_public = Column(Boolean, nullable=False, default=True)
    is_important = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class UserNoticeRead(Base):
    __tablename__ = "user_notice_reads"

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), primary_key=True)
    notice_id = Column(Integer, ForeignKey('notices.notice_id'), primary_key=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notice_reads")
    notice = relationship("Notice")