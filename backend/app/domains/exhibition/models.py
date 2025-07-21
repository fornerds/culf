from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, JSON, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Institution(Base):
    """기관 정보 모델"""
    __tablename__ = "institutions"
    
    institution_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text)
    address = Column(String(500))
    phone = Column(String(50))
    website = Column(String(500))
    email = Column(String(100))
    
    # 위치 정보
    latitude = Column(Float)
    longitude = Column(Float)
    
    # 메타데이터
    source = Column(String(100))  # 데이터 출처
    is_active = Column(Boolean, default=True)
    
    # 시스템 필드
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    exhibitions = relationship("Exhibition", back_populates="institution")


class DataSource(Base):
    """데이터 소스 정보 모델"""
    __tablename__ = "data_sources"
    
    source_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)
    source_type = Column(String(50))  # api, file, crawl 등
    description = Column(String(500))  # 데이터 소스 설명
    url = Column(String(1000))
    api_endpoint = Column(String(1000))  # CulturalHub 시스템 호환을 위한 API 엔드포인트
    api_key_required = Column(Boolean, default=False)
    config = Column(JSON)  # API 설정 정보
    
    # CulturalHub 시스템 호환 필드
    status = Column(String(50), default='active')
    last_collected_at = Column(DateTime(timezone=True))
    total_records = Column(Integer, default=0)
    success_rate = Column(Float, default=100.0)
    collection_info = Column(JSON)
    
    # 수집 관련 설정
    is_active = Column(Boolean, default=True)
    collection_interval = Column(Integer, default=3600)  # 초 단위
    last_collected = Column(DateTime(timezone=True))
    
    # 시스템 필드
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 호환성을 위한 별칭
    @property
    def id(self):
        return self.source_id


class Exhibition(Base):
    """전시 정보 모델"""
    __tablename__ = "exhibitions"
    
    exhibition_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    venue = Column(String(300), index=True)
    address = Column(String(500))
    start_date = Column(DateTime, index=True)
    end_date = Column(DateTime, index=True)
    period = Column(String(300))  # CulturalHub 시스템 호환을 위한 기간 정보
    time_info = Column(String(300))  # 시간 정보
    price = Column(String(200))
    contact = Column(String(100))
    website = Column(String(500))
    image_url = Column(String(500))
    category = Column(String(100), index=True)
    organizer = Column(String(300))
    
    # CulturalHub 시스템 추가 필드
    genre = Column(String(100))  # 장르
    artist = Column(String(300))  # 작가
    website_url = Column(String(500))  # 홈페이지주소
    contact_info = Column(String(200))  # 문의
    admission_fee = Column(String(300))  # 관람료할인정보
    external_id = Column(String(100), index=True)  # 전시ID (중복 검사용)
    
    # 기관 관계
    institution_id = Column(Integer, ForeignKey("institutions.institution_id"))
    institution = relationship("Institution", back_populates="exhibitions")
    
    # 메타데이터
    source = Column(String(100), index=True)  # 데이터 출처
    api_source = Column(String(100), index=True)  # CulturalHub 시스템 호환을 위한 API 소스
    source_id = Column(String(100))  # 원본 데이터 ID
    is_active = Column(Boolean, default=True, index=True)
    
    # 위치 정보
    latitude = Column(Float)
    longitude = Column(Float)
    
    # 시스템 필드
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    collected_at = Column(DateTime(timezone=True), index=True)
    
    # 중복 방지를 위한 복합 인덱스들
    __table_args__ = (
        # 기관+제목+장소 기준 복합 인덱스 (중복 검사 최적화)
        Index('idx_exhibition_duplicate_check', 'institution_id', 'title', 'venue'),
        
        # API 소스+외부 ID 기준 복합 인덱스 (외부 시스템 연동 최적화)
        Index('idx_exhibition_external', 'api_source', 'external_id'),
        
        # 수집 시간 기준 인덱스 (증분 수집 최적화)
        Index('idx_exhibition_collected', 'collected_at', 'api_source'),
        
        # 전시 기간 검색 최적화
        Index('idx_exhibition_period', 'start_date', 'end_date', 'is_active'),
        
        # 유니크 제약 조건 (동일 API 소스에서 같은 외부 ID 중복 방지)
        UniqueConstraint('api_source', 'external_id', name='uq_exhibition_api_external_id'),
    ) 