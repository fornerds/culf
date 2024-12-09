from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class BannerBase(BaseModel):
    target_url: Optional[str] = Field(None, example="https://example.com")
    start_date: date = Field(..., example="2024-10-01")
    end_date: date = Field(..., example="2024-10-31")

class Banner(BannerBase):
    banner_id: int
    image_url: str
    click_count: int = 0
    is_public: bool = True

    class Config:
        from_attributes = True

class BannerCreate(BaseModel):
    target_url: Optional[str] = Field(None, example="https://example.com")
    start_date: date = Field(..., example="2024-10-01")
    end_date: date = Field(..., example="2024-10-31")
    is_public: bool = Field(True, example=True)

class BannerUpdate(BaseModel):
    target_url: Optional[str] = Field(None, example="https://example.com")
    start_date: Optional[date] = Field(None, example="2024-10-01")
    end_date: Optional[date] = Field(None, example="2024-10-31")
    is_public: Optional[bool] = Field(None, example=True)