from sqlalchemy import Column, PrimaryKeyConstraint, String, Date, Enum, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import uuid

class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=True)
    nickname = Column(String(50), unique=True, nullable=False)
    phone_number = Column(String(20)) # todo UNIQUE contraint 임시 제거
    birthdate = Column(Date, nullable=False)
    gender = Column(Enum('M', 'F', 'N', name='gender_enum'), nullable=False, default='N')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))
    status = Column(Enum('ACTIVE', 'INACTIVE', 'BANNED', 'WITHDRAWN', name='user_status_enum'), nullable=False, default='ACTIVE')
    role = Column(Enum('USER', 'ADMIN', name='user_role_enum'), nullable=False, default='USER')
    delete_reason = Column(Text)
    marketing_agreed = Column(Boolean, nullable=False, default=False)
    is_corporate = Column(Boolean, nullable=False, default=False)
    provider = Column(String(50))
    provider_id = Column(String(255))

    # Relationships
    conversations = relationship("Conversation", back_populates="user")
    chat_rooms = relationship("ChatRoom", back_populates="user")
    tokens = relationship("Token", back_populates="user", uselist=False)
    corporate_info = relationship("CorporateUser", back_populates="user", uselist=False)
    inquiries = relationship("Inquiry", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    notification_settings = relationship("UserNotificationSetting", back_populates="user")
    notice_reads = relationship("UserNoticeRead", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    inquiries = relationship("Inquiry", back_populates="user")

# class model for UserProvider that refer User
class UserProvider(Base):
    __tablename__ = 'user_provider'
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
    provider = Column(Enum('GOOGLE', 'KAKAO', name='provider_enum'), nullable=False)
    provider_id = Column(String(255), nullable=False)
    
    __table_args__ = (
        PrimaryKeyConstraint(user_id, provider_id),
    )

class CorporateUser(Base):
    __tablename__ = "corporate_users"

    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), primary_key=True)
    company_name = Column(String(255), nullable=False)
    business_number = Column(String(20))
    contact_person = Column(String(50))
    contact_phone = Column(String(20))
    address = Column(String(255))

    user = relationship("User", back_populates="corporate_info")