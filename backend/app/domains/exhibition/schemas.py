from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# Institution 스키마
class InstitutionBase(BaseModel):
    name: str
    institution_type: Optional[str] = None
    address: Optional[str] = None
    contact: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class InstitutionCreate(InstitutionBase):
    pass


class InstitutionUpdate(InstitutionBase):
    name: Optional[str] = None


class InstitutionInDB(InstitutionBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Institution(InstitutionInDB):
    pass


# DataSource 스키마
class DataSourceBase(BaseModel):
    name: str
    source_type: Optional[str] = None
    url: Optional[str] = None
    api_key_required: bool = False
    config: Optional[Dict[str, Any]] = None
    collection_interval: int = 3600


class DataSourceCreate(DataSourceBase):
    pass


class DataSourceUpdate(DataSourceBase):
    name: Optional[str] = None


class DataSourceInDB(DataSourceBase):
    id: int
    is_active: bool
    last_collected: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DataSource(DataSourceInDB):
    pass


# Exhibition 스키마
class ExhibitionBase(BaseModel):
    title: str
    description: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    price: Optional[str] = None
    contact: Optional[str] = None
    website: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    organizer: Optional[str] = None
    source: Optional[str] = None
    source_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ExhibitionCreate(ExhibitionBase):
    pass


class ExhibitionUpdate(ExhibitionBase):
    title: Optional[str] = None


class ExhibitionInDB(ExhibitionBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Exhibition(ExhibitionInDB):
    pass 

class CulturalHubCollectionRequest(BaseModel):
    """CulturalHub 데이터 수집 요청"""
    max_pages: int = 10
    use_sequential: bool = True
    incremental: bool = True

class CulturalHubCollectionResponse(BaseModel):
    """CulturalHub 데이터 수집 응답"""
    success: bool
    message: str
    total_collected: int
    total_new: int
    total_updated: int
    total_skipped: int
    working_apis: int
    total_apis: int
    success_rate: float
    api_details: Dict[str, Dict[str, int]]

class CulturalHubStatusResponse(BaseModel):
    """CulturalHub 상태 응답"""
    system_summary: Dict[str, Any]
    all_api_sources: List[Dict[str, Any]]
    cultural_hub_sources: List[Dict[str, Any]]
    cultural_hub_total: int

class CulturalHubTestResponse(BaseModel):
    """CulturalHub API 테스트 응답"""
    success: bool
    total_apis: int
    working_apis: int
    success_rate: float
    test_data_count: int
    details: Dict[str, Any]
    message: str

class CulturalHubSyncRequest(BaseModel):
    """CulturalHub 동기화 요청"""
    source_name: Optional[str] = None
    force_update: bool = False

class CulturalHubSyncResponse(BaseModel):
    """CulturalHub 동기화 응답"""
    success: bool
    message: str
    synced_count: int
    updated_count: int
    details: Dict[str, Any] 