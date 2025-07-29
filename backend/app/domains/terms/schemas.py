from pydantic import BaseModel
from datetime import date

class TermsBase(BaseModel):
    type: str
    content: str
    version: str
    effective_date: date

class TermsCreate(TermsBase):
    pass

class Terms(TermsBase):
    terms_id: int

    class Config:
        from_attributes = True