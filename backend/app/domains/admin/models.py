from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy import func
from app.db.base_class import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    setting_id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(255), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)