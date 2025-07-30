#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, Float, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


# ================================
# OpenAPI 수집 데이터 모델
# ================================

class CultureHub(Base):
    """OpenAPI로 수집된 문화행사 데이터"""
    __tablename__ = "culture_hubs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 기본 정보
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text)
    
    # 기간 정보
    start_date = Column(Date, index=True)
    end_date = Column(Date, index=True)
    period = Column(String(300))  # 기간 문자열 (API에서 오는 원본)
    
    # 장소 정보
    venue = Column(String(300), index=True)
    
    # 분류
    category = Column(String(100), index=True)  # 전시, 공연, 체험 등
    
    # 참여자
    artist = Column(String(300))     # 작가/연주자
    
    # 요금
    price = Column(String(200))      # 요금 정보
    
    # 웹 정보
    website = Column(String(500))
    image_url = Column(String(500))
    
    # API 메타데이터
    api_source = Column(String(100), nullable=False, index=True)
    culture_code = Column(String(200), nullable=True, index=True)  # 문화 콘텐츠 고유 코드
    
    # 시스템
    collected_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)  # 운영 상태: 활성/비활성
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 인덱스 및 제약
    __table_args__ = (
        Index('idx_culture_hub_period', 'start_date', 'end_date'),
        Index('idx_culture_hub_venue', 'venue'),
        Index('idx_culture_hub_category', 'category'),
        Index('idx_culture_hub_api_source', 'api_source'),
    )


# ================================
# 관리자 관리 데이터 모델
# ================================

class Institution(Base):
    """관리자가 관리하는 기관 정보"""
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 기본 정보
    name = Column(String(300), nullable=False, index=True)
    type = Column(String(100), index=True)  # 미술관, 박물관, 공연장 등
    category = Column(String(100))          # 세부 분류
    
    # 연락처
    contact = Column(String(100))  # 연락처 (전화번호, 팩스 등)
    email = Column(String(200))
    website = Column(String(500))
    manager = Column(String(100))  # 담당자명
    
    # 위치
    address = Column(String(500))
    latitude = Column(Float)
    longitude = Column(Float)
    
    # 설명
    description = Column(Text)
    
    # 시스템
    is_active = Column(Boolean, default=True, index=True)  # 운영 상태: 활성/비활성
    is_deleted = Column(Boolean, default=False, index=True)  # 삭제 상태: 삭제됨/삭제되지않음
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100))  # 등록한 관리자
    
    # 관계
    exhibitions = relationship("Exhibition", back_populates="institution", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_institution_type', 'type', 'category'),
        Index('idx_institution_location', 'latitude', 'longitude'),
    )


class Exhibition(Base):
    """관리자가 관리하는 전시/공연 정보"""
    __tablename__ = "exhibitions"
    
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True)
    
    # 기본 정보
    title = Column(String(500), nullable=False, index=True)
    subtitle = Column(String(500))
    description = Column(Text)
    
    # 기간
    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True, index=True)
    
    # 장소
    venue = Column(String(200))
    address = Column(String(500))
    
    # 분류
    category = Column(String(100), index=True)
    genre = Column(String(100))
    
    # 참여자
    artist = Column(String(300))
    host = Column(String(300))
    
    # 연락처
    contact = Column(String(200))
    
    # 요금
    price = Column(String(200))
    
    # 웹 정보
    website = Column(String(500))
    image_url = Column(String(500))
    
    # 기타
    keywords = Column(String(500))
    
    # 상태
    status = Column(String(30), default='active', index=True)
    is_active = Column(Boolean, default=True, index=True)
    is_deleted = Column(Boolean, default=False, index=True)  # 삭제 상태
    
    # 시스템
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100))
    
    # 관계
    institution = relationship("Institution", back_populates="exhibitions")
    
    __table_args__ = (
        Index('idx_exhibition_period', 'start_date', 'end_date'),
        Index('idx_exhibition_status', 'status', 'is_active'),
        Index('idx_exhibition_title', 'title'),
        Index('idx_exhibition_category', 'category'),
    )


# ================================
# 파일 관리 모델
# ================================

class SmartFile(Base):
    """파일 업로드 및 AI 처리 관리"""
    __tablename__ = "smart_files"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 파일 정보
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(50))      # pdf, doc, txt 등
    mime_type = Column(String(100))
    
    # 연결 정보
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"))
    exhibition_id = Column(Integer, ForeignKey("exhibitions.id", ondelete="CASCADE"))
    
    # AI 처리 결과
    ai_summary = Column(Text)
    ai_category = Column(String(100))    # exhibition_catalog, artist_info 등
    confidence_score = Column(Float)
    
    # 처리 상태
    processing_status = Column(String(30), default='pending')  # pending, processing, completed, failed
    processing_error = Column(Text)
    
    # 추출 정보
    total_pages = Column(Integer)
    extracted_text = Column(Text)
    
    # 시스템
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('idx_smart_file_institution', 'institution_id'),
        Index('idx_smart_file_exhibition', 'exhibition_id'),
        Index('idx_smart_file_status', 'processing_status'),
    )


# ================================
# 임베딩 및 검색 모델
# ================================

class EventEmbedding(Base):
    """문화행사 AI 임베딩 (검색용)"""
    __tablename__ = "event_embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 연결 정보 (둘 중 하나만 있음)
    culture_hub_id = Column(Integer, ForeignKey("culture_hubs.id", ondelete="CASCADE"))
    exhibition_id = Column(Integer, ForeignKey("exhibitions.id", ondelete="CASCADE"))
    
    # 임베딩 데이터
    embedding_vector = Column(Text, nullable=False)  # JSON 배열로 저장
    text_content = Column(Text)                      # 원본 텍스트
    
    # 메타데이터
    embedding_model = Column(String(50), default='text-embedding-3-small')
    vector_dimension = Column(Integer, default=1536)
    
    # 시스템
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_embedding_culture_hub', 'culture_hub_id'),
        Index('idx_embedding_exhibition', 'exhibition_id'),
    )


# ================================
# API 관리 모델
# ================================

class ApiSource(Base):
    """OpenAPI 소스 관리"""
    __tablename__ = "api_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 기본 정보
    api_key = Column(String(200), unique=True, nullable=False, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text)
    base_url = Column(String(500))
    location = Column(String(100))
    
    # 상태
    is_active = Column(Boolean, default=True)
    
    # 통계
    total_collected = Column(Integer, default=0)
    last_collection_at = Column(DateTime(timezone=True))
    
    # 시스템
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_api_source_active', 'is_active'),
    )


 