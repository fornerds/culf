from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FooterBase(BaseModel):
    company_name: str
    ceo_name: str
    business_number: str
    address: str
    email: str
    customer_center_number: str

class FooterCreate(FooterBase):
    pass

class FooterUpdate(FooterBase):
    pass

class FooterResponse(FooterBase):
    footer_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True