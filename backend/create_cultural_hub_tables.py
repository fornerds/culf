#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
문화 허브 관련 테이블 생성 스크립트
기존 테이블을 삭제하고 새로운 스키마로 다시 생성합니다.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 현재 스크립트의 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.core.config import settings

def create_cultural_hub_tables():
    """문화 허브 관련 테이블들을 생성합니다."""
    
    # 데이터베이스 연결
    db_url = f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?client_encoding=utf8"
    engine = create_engine(db_url)
    
    print("문화 허브 테이블 생성을 시작합니다...")
    
    # 기존 테이블 삭제 (순서 중요 - 외래키 관계 고려)
    drop_tables_sql = """
    -- 기존 테이블들 삭제 (의존성 순서대로)
    DROP TABLE IF EXISTS smart_files CASCADE;
    DROP TABLE IF EXISTS exhibitions CASCADE;
    DROP TABLE IF EXISTS culture_hubs CASCADE;
    DROP TABLE IF EXISTS api_sources CASCADE;
    DROP TABLE IF EXISTS institutions CASCADE;
    """
    
    # 테이블 생성 SQL
    create_tables_sql = """
    -- 기관 테이블
    CREATE TABLE institutions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(300) NOT NULL,
        type VARCHAR(100),
        category VARCHAR(100),
        contact VARCHAR(100),
        email VARCHAR(200),
        website VARCHAR(500),
        manager VARCHAR(100),
        address VARCHAR(500),
        latitude FLOAT,
        longitude FLOAT,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(100)
    );

    CREATE INDEX idx_institution_type ON institutions(type, category);
    CREATE INDEX idx_institution_location ON institutions(latitude, longitude);

    -- 전시/공연 테이블 (관리자가 직접 관리)
    CREATE TABLE exhibitions (
        id SERIAL PRIMARY KEY,
        institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
        
        -- 기본 정보
        title VARCHAR(500) NOT NULL,
        subtitle VARCHAR(500),
        description TEXT,
        
        -- 기간
        start_date DATE,
        end_date DATE,
        
        -- 장소
        venue VARCHAR(200),
        address VARCHAR(500),
        
        -- 분류
        category VARCHAR(100),
        genre VARCHAR(100),
        
        -- 참여자
        artist VARCHAR(300),
        host VARCHAR(300),
        
        -- 연락처
        contact VARCHAR(200),
        
        -- 요금
        price VARCHAR(200),
        
        -- 웹 정보
        website VARCHAR(500),
        image_url VARCHAR(500),
        
        -- 기타
        keywords VARCHAR(500),
        
        -- 상태
        status VARCHAR(30) DEFAULT 'active',
        is_active BOOLEAN DEFAULT TRUE,
        
        -- 시스템
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(100)
    );

    CREATE INDEX idx_exhibition_period ON exhibitions(start_date, end_date);
    CREATE INDEX idx_exhibition_status ON exhibitions(status, is_active);
    CREATE INDEX idx_exhibition_title ON exhibitions(title);
    CREATE INDEX idx_exhibition_category ON exhibitions(category);

    -- OpenAPI 수집 데이터 테이블
    CREATE TABLE culture_hubs (
        id SERIAL PRIMARY KEY,
        
        -- 기본 정보
        title VARCHAR(500) NOT NULL,
        description TEXT,
        
        -- 기간 정보
        start_date DATE,
        end_date DATE,
        period VARCHAR(300),
        
        -- 장소 정보
        venue VARCHAR(300),
        
        -- 분류
        category VARCHAR(100),
        
        -- 참여자
        artist VARCHAR(300),
        
        -- 요금
        price VARCHAR(200),
        
        -- 웹 정보
        website VARCHAR(500),
        image_url VARCHAR(500),
        
        -- API 메타데이터
        api_source VARCHAR(100) NOT NULL,
        culture_code VARCHAR(200),
        
        -- 시스템
        collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_culture_hub_period ON culture_hubs(start_date, end_date);
    CREATE INDEX idx_culture_hub_venue ON culture_hubs(venue);
    CREATE INDEX idx_culture_hub_category ON culture_hubs(category);
    CREATE INDEX idx_culture_hub_api_source ON culture_hubs(api_source);
    CREATE INDEX idx_culture_hub_title ON culture_hubs(title);

    -- API 소스 테이블
    CREATE TABLE api_sources (
        id SERIAL PRIMARY KEY,
        api_key VARCHAR(200) NOT NULL UNIQUE,
        name VARCHAR(300) NOT NULL,
        description TEXT,
        base_url VARCHAR(500),
        location VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        total_collected INTEGER DEFAULT 0,
        last_collection_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_api_sources_key ON api_sources(api_key);
    CREATE INDEX idx_api_sources_active ON api_sources(is_active);

    -- 파일 관리 테이블
    CREATE TABLE smart_files (
        id SERIAL PRIMARY KEY,
        
        -- 파일 정보
        filename VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size INTEGER,
        file_type VARCHAR(50),
        mime_type VARCHAR(100),
        
        -- 연결 정보
        institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
        exhibition_id INTEGER REFERENCES exhibitions(id) ON DELETE CASCADE,
        
        -- AI 처리 결과
        ai_summary TEXT,
        ai_category VARCHAR(100),
        confidence_score FLOAT,
        
        -- 처리 상태
        processing_status VARCHAR(30) DEFAULT 'pending',
        processing_error TEXT,
        
        -- 추출 정보
        total_pages INTEGER,
        extracted_text TEXT,
        
        -- 시스템
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(100)
    );

    CREATE INDEX idx_smart_file_institution ON smart_files(institution_id);
    CREATE INDEX idx_smart_file_exhibition ON smart_files(exhibition_id);
    CREATE INDEX idx_smart_file_status ON smart_files(processing_status);
    CREATE INDEX idx_smart_files_active ON smart_files(is_active);
    """
    
    # 기본 데이터 삽입 SQL
    insert_data_sql = """
    -- 기본 기관 데이터 삽입
    INSERT INTO institutions (name, type, category, address, is_active, created_by) VALUES
    ('국립현대미술관', '미술관', '국립', '서울특별시 종로구 삼청로 30', true, 'system'),
    ('서울시립미술관', '미술관', '시립', '서울특별시 중구 덕수궁길 61', true, 'system'),
    ('국립중앙박물관', '박물관', '국립', '서울특별시 용산구 서빙고로 137', true, 'system'),
    ('예술의전당', '복합문화시설', '공공', '서울특별시 서초구 남부순환로 2406', true, 'system');

    -- API 소스 기본 데이터 삽입
    INSERT INTO api_sources (api_key, name, description, base_url, location, is_active) VALUES
    ('kcdf', '한국공예디자인문화진흥원 전시도록', '공예 및 디자인 관련 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('kocaca', '한국문화예술회관연합회 공연전시정보', '전국 문화예술회관 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('history_museum', '대한민국역사박물관 특별전시', '역사박물관 특별전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('arko', '한국문화예술위원회 아르코미술관전시', '아르코미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('jeju_culture', '제주문화예술진흥원 공연전시정보', '제주 지역 문화예술 정보', 'http://www.jeju.go.kr/rest', '제주', true),
    ('hangeul_museum', '국립한글박물관 전시정보', '한글박물관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('mmca', '국립현대미술관 전시정보', '국립현대미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('sema_archive', '서울시립미술관 아카이브', '서울시립미술관 아카이브 정보', 'https://sema.seoul.go.kr', '서울', true),
    ('sema', '서울시립미술관 전시정보', '서울시립미술관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('barrier_free', '한국문화정보원 전국 문화예술관광지 배리어프리 정보', '배리어프리 문화시설 정보', 'http://api.kcisa.kr/openapi', '전국', true),
    ('museum_catalog', '국립중앙박물관 외 전시도록', '국립중앙박물관 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('integrated_exhibition', '한국문화정보원 외 전시정보(통합)', '통합 전시 정보', 'http://api.kcisa.kr/openapi', '전국', true),
    ('mapo_art', '마포문화재단 마포아트센터공연전시', '마포아트센터 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('arts_center', '예술의전당 전시정보', '예술의전당 전시 정보', 'http://api.kcisa.kr/openapi', '서울', true),
    ('daegu_culture', '대구광역시 공연전시정보', '대구 지역 공연 및 전시 정보', 'https://dgfca.or.kr/api', '대구', true),
    ('jeonju_culture', '전주시 공연전시정보', '전주 지역 공연 및 전시 정보', 'http://api.kcisa.kr/openapi', '전주', true);
    """
    
    try:
        with engine.connect() as conn:
            # 트랜잭션 시작
            trans = conn.begin()
            
            try:
                print("기존 테이블을 삭제합니다...")
                conn.execute(text(drop_tables_sql))
                
                print("새로운 테이블을 생성합니다...")
                conn.execute(text(create_tables_sql))
                
                print("기본 데이터를 삽입합니다...")
                conn.execute(text(insert_data_sql))
                
                # 트랜잭션 커밋
                trans.commit()
                
                print("문화 허브 테이블 생성이 완료되었습니다!")
                
                # 생성된 테이블 확인
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('institutions', 'exhibitions', 'culture_hubs', 'api_sources', 'smart_files')
                    ORDER BY table_name;
                """))
                
                tables = [row[0] for row in result]
                print(f"생성된 테이블: {', '.join(tables)}")
                
                # 기본 데이터 확인
                inst_count = conn.execute(text("SELECT COUNT(*) FROM institutions")).scalar()
                api_count = conn.execute(text("SELECT COUNT(*) FROM api_sources")).scalar()
                
                print(f"기관 데이터: {inst_count}개")
                print(f"API 소스: {api_count}개")
                
            except Exception as e:
                trans.rollback()
                raise e
                
    except Exception as e:
        print(f"오류 발생: {str(e)}")
        raise e

if __name__ == "__main__":
    create_cultural_hub_tables() 