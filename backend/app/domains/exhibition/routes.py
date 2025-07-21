"""
전시 데이터 수집 API 라우터
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from .models import Exhibition, Institution
from .schemas import Exhibition, ExhibitionCreate, CulturalHubCollectionRequest, CulturalHubCollectionResponse, CulturalHubStatusResponse, CulturalHubTestResponse, CulturalHubSyncRequest, CulturalHubSyncResponse
# from .bulletproof_service import BulletproofExhibitionService  # 삭제됨
from typing import List, Optional
from sqlalchemy import text
from datetime import datetime
import asyncio

# CulturalHub 시스템 엔드포인트들 추가
from .cultural_hub_service import CulturalHubExhibitionService

router = APIRouter()

# 기존 엔드포인트들...
@router.get("/", response_model=List[Exhibition])
def get_exhibitions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """전시 목록 조회"""
    exhibitions = db.query(Exhibition).offset(skip).limit(limit).all()
    return exhibitions

@router.post("/", response_model=Exhibition)
def create_exhibition(
    exhibition: ExhibitionCreate,
    db: Session = Depends(get_db)
):
    """전시 생성"""
    db_exhibition = Exhibition(**exhibition.dict())
    db.add(db_exhibition)
    db.commit()
    db.refresh(db_exhibition)
    return db_exhibition

# 기존 integrated 엔드포인트는 제거됨 - CulturalHub로 대체

@router.delete("/clear-data")
async def clear_all_data(
    confirm: bool = Query(False, description="확인 없이 삭제"),
    db: Session = Depends(get_db)
):
    """데이터베이스 전체 초기화"""
    try:
        if not confirm:
            raise HTTPException(
                status_code=400, 
                detail="데이터 삭제를 위해 confirm=true 파라미터를 추가해주세요"
            )
        
        deleted_counts = await clear_database_data(db, confirm=True)
        
        return {
            "success": True,
            "message": "데이터베이스 초기화 완료",
            "deleted_counts": deleted_counts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 초기화 실패: {str(e)}")

@router.get("/integrated/status")
def get_integrated_status(db: Session = Depends(get_db)):
    """통합 시스템 상태 조회"""
    try:
        # 전체 통계
        exhibition_count = db.execute(text("SELECT COUNT(*) FROM exhibitions")).scalar()
        institution_count = db.execute(text("SELECT COUNT(*) FROM institutions")).scalar()
        source_count = db.execute(text("SELECT COUNT(*) FROM data_sources")).scalar()
        
        # 최근 수집 정보
        last_collected = db.execute(text(
            "SELECT MAX(collected_at) FROM exhibitions WHERE collected_at IS NOT NULL"
        )).scalar()
        
        # API 소스별 상세 통계
        source_stats = db.execute(text("""
            SELECT api_source, COUNT(*) as count, MAX(collected_at) as last_collected
            FROM exhibitions 
            WHERE api_source IS NOT NULL
            GROUP BY api_source 
            ORDER BY count DESC
        """)).fetchall()
        
        # 최근 수집된 전시 데이터
        recent_exhibitions = db.execute(text("""
            SELECT title, venue, api_source, collected_at
            FROM exhibitions 
            WHERE collected_at IS NOT NULL
            ORDER BY collected_at DESC 
            LIMIT 10
        """)).fetchall()
        
        # 기관별 통계
        institution_stats = db.execute(text("""
            SELECT i.name, COUNT(e.exhibition_id) as exhibition_count
            FROM institutions i
            LEFT JOIN exhibitions e ON i.institution_id = e.institution_id
            GROUP BY i.institution_id, i.name
            ORDER BY exhibition_count DESC
            LIMIT 10
        """)).fetchall()
        
        return {
            "summary": {
                "total_exhibitions": exhibition_count,
                "total_institutions": institution_count,
                "total_sources": source_count,
                "last_collection": last_collected
            },
            "api_sources": [
                {
                    "name": row[0],
                    "count": row[1],
                    "last_collected": row[2]
                } for row in source_stats
            ],
            "recent_exhibitions": [
                {
                    "title": row[0],
                    "venue": row[1],
                    "api_source": row[2],
                    "collected_at": row[3]
                } for row in recent_exhibitions
            ],
            "top_institutions": [
                {
                    "name": row[0],
                    "exhibition_count": row[1]
                } for row in institution_stats
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {str(e)}")

# 헬퍼 함수
async def clear_database_data(db: Session, confirm: bool = True):
    """데이터베이스 데이터 초기화"""
    tables = ['exhibitions', 'institutions', 'data_sources']
    deleted_counts = {}
    
    try:
        for table in tables:
            # 데이터 삭제
            result = db.execute(text(f"DELETE FROM {table}"))
            deleted_counts[table] = result.rowcount
            
            # 시퀀스 리셋
            if table == 'exhibitions':
                db.execute(text("ALTER SEQUENCE exhibitions_exhibition_id_seq RESTART WITH 1"))
            elif table == 'institutions':
                db.execute(text("ALTER SEQUENCE institutions_institution_id_seq RESTART WITH 1"))
            elif table == 'data_sources':
                db.execute(text("ALTER SEQUENCE data_sources_source_id_seq RESTART WITH 1"))
        
        db.commit()
        return deleted_counts
        
    except Exception as e:
        db.rollback()
        raise e 

# 새로운 CulturalHub 엔드포인트들 - 기존 내용 뒤에 추가
@router.post("/cultural-hub/collect")
async def collect_cultural_hub_data(
    max_pages: int = Query(10, description="각 API당 수집할 최대 페이지 수"),
    use_sequential: bool = Query(True, description="순차 처리 모드 사용"),
    incremental: bool = Query(True, description="증분 수집 모드 (중복 제거)"),
    db: Session = Depends(get_db)
):
    """CulturalHub 15개 문화기관 API에서 중복 없이 데이터 수집"""
    try:
        service = CulturalHubExhibitionService(db)
        result = await service.collect_all_exhibitions_safely(
            max_pages=max_pages,
            use_sequential=use_sequential,
            incremental=incremental
        )
        
        if result['success']:
            return {
                "success": True,
                "message": "CulturalHub 데이터 수집 성공",
                "total_collected": result['total_collected'],
                "total_new": result.get('total_new', 0),
                "total_updated": result.get('total_updated', 0),
                "total_skipped": result.get('total_skipped', 0),
                "working_apis": result['working_apis'],
                "total_apis": result['total_apis'],
                "success_rate": result['success_rate'],
                "api_details": result.get('api_details', {})
            }
        else:
            raise HTTPException(status_code=500, detail=f"CulturalHub 데이터 수집 실패: {result.get('message')}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CulturalHub 데이터 수집 중 오류 발생: {str(e)}")

@router.get("/cultural-hub/test")
async def test_cultural_hub_apis(
    quick_test: bool = Query(True, description="빠른 테스트 모드"),
    db: Session = Depends(get_db)
):
    """CulturalHub 15개 API 연결 테스트"""
    try:
        service = CulturalHubExhibitionService(db)
        result = await service.test_all_cultural_apis(quick_test=quick_test)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CulturalHub API 테스트 실패: {str(e)}")

@router.get("/cultural-hub/status")
def get_cultural_hub_status(db: Session = Depends(get_db)):
    """CulturalHub 시스템 상태 조회"""
    try:
        # 전시 데이터 개수
        exhibition_count = db.execute(text("SELECT COUNT(*) FROM exhibitions")).scalar()
        
        # 기관 데이터 개수
        institution_count = db.execute(text("SELECT COUNT(*) FROM institutions")).scalar()
        
        # 데이터 소스 개수
        source_count = db.execute(text("SELECT COUNT(*) FROM data_sources")).scalar()
        
        # 최근 수집 시간
        last_collected = db.execute(text(
            "SELECT MAX(collected_at) FROM exhibitions WHERE collected_at IS NOT NULL"
        )).scalar()
        
        # 모든 API 소스 정보 (data_sources 테이블에서 가져오기)
        all_sources = db.execute(text("""
            SELECT 
                ds.name,
                ds.description,
                ds.api_endpoint,
                ds.source_type,
                COALESCE(ds.status, 'active') as status,
                COALESCE(ex_count.data_count, 0) as data_count,
                ds.last_collected_at as last_sync,
                CASE 
                    WHEN ds.api_endpoint IS NOT NULL AND ds.api_endpoint != '' THEN true
                    ELSE false
                END as is_working,
                COALESCE(ds.source_type, '기타') as institution_type,
                CASE 
                    WHEN ds.name = '예술의전당' THEN '서울'
                    WHEN ds.name = '대한민국역사박물관' THEN '서울'
                    WHEN ds.name = '국립한글박물관' THEN '서울'
                    WHEN ds.name = '한국문화예술회관연합회' THEN '전국'
                    WHEN ds.name = '한국공예디자인문화진흥원' THEN '서울'
                    WHEN ds.name = '한국문화예술위원회' THEN '서울'
                    WHEN ds.name = '전주시' THEN '전북'
                    WHEN ds.name = '서울시립미술관' THEN '서울'
                    WHEN ds.name = '마포문화재단' THEN '서울'
                    WHEN ds.name = '국립현대미술관' THEN '서울/과천/청주'
                    WHEN ds.name = '한국문화정보원' THEN '전국'
                    WHEN ds.name = '한국문화정보원_배리어프리' THEN '전국'
                    WHEN ds.name = '국립중앙박물관' THEN '서울'
                    WHEN ds.name = '제주문화예술진흥원' THEN '제주'
                    WHEN ds.name = '대구광역시' THEN '대구'
                    ELSE '전국'
                END as location,
                ds.source_id
            FROM data_sources ds
            LEFT JOIN (
                SELECT api_source, COUNT(*) as data_count
                FROM exhibitions 
                WHERE api_source IS NOT NULL
                GROUP BY api_source
            ) ex_count ON ds.name = ex_count.api_source
            ORDER BY ds.source_id
        """)).fetchall()
        
        return {
            "system_summary": {
                "total_exhibitions": exhibition_count,
                "total_institutions": institution_count,
                "total_sources": source_count,
                "last_collection": last_collected
            },
            "all_api_sources": [
                {
                    "name": row.name,
                    "description": row.description,
                    "api_endpoint": row.api_endpoint,
                    "institution_type": row.institution_type,
                    "location": row.location,
                    "is_working": row.is_working,
                    "data_count": row.data_count,
                    "last_sync": row.last_sync,
                    "source_id": row.source_id,
                    "priority": idx + 1
                } for idx, row in enumerate(all_sources)
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CulturalHub 상태 조회 실패: {str(e)}")

@router.post("/cultural-hub/sync")
async def sync_cultural_hub_data(
    source_name: Optional[str] = Query(None, description="특정 소스만 동기화"),
    force_update: bool = Query(False, description="강제 업데이트"),
    db: Session = Depends(get_db)
):
    """특정 CulturalHub 소스 데이터 동기화"""
    try:
        service = CulturalHubExhibitionService(db)
        result = await service.sync_specific_source(
            source_name=source_name,
            force_update=force_update
        )
        
        return {
            "success": True,
            "message": f"{'전체' if not source_name else source_name} 동기화 완료",
            "synced_count": result.get('synced_count', 0),
            "updated_count": result.get('updated_count', 0),
            "details": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CulturalHub 동기화 실패: {str(e)}") 