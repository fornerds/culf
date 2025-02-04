from sqlalchemy import Column, Integer, String, Date, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy import func
from app.db.base_class import Base

class Banner(Base):
    __tablename__ = "banners"

    banner_id = Column(Integer, primary_key=True, autoincrement=True)
    image_url = Column(String, nullable=False)
    target_url = Column(String, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_public = Column(Boolean, default=True)
    click_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)