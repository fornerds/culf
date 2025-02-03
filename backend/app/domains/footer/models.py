from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.base_class import Base

class Footer(Base):
    __tablename__ = "footers"

    footer_id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(100), nullable=False)
    ceo_name = Column(String(50), nullable=False)
    business_number = Column(String(20), nullable=False)
    address = Column(Text, nullable=False)
    email = Column(String(100), nullable=False)
    customer_center_number = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())