"""
🎨 CulturalHub! 전시 데이터 수집 서비스
15개 문화기관 API 모두 안전하게 중앙 집중화하는 문화 허브 시스템을 기존 도메인에 통합
🔄 증분 수집으로 중복 없이 새로운 데이터만 추가
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
import sys
import os
from pathlib import Path

# CulturalHub 시스템 임포트
sys.path.append(str(Path(__file__).parent.parent.parent.parent))
from cultural_hub_api_system import CulturalHubAPISystem

from app.domains.exhibition.models import Institution, Exhibition, DataSource
from app.core.config import settings

logger = logging.getLogger(__name__)


class CulturalHubExhibitionService:
    """🎨 CulturalHub 전시 데이터 수집 서비스 - 중복 없는 증분 수집"""
    
    def __init__(self, db: Session):
        self.db = db
        self.cultural_hub_system = CulturalHubAPISystem()
        
    async def collect_all_exhibitions_safely(
        self, 
        max_pages: int = 10, 
        use_sequential: bool = True,
        incremental: bool = True
    ) -> Dict[str, Any]:
        """🎨 15개 문화기관 API 모두에서 안전하게 전시 데이터 수집 (중복 제거)"""
        try:
            logger.info("🎨 CulturalHub 증분 데이터 수집 시작")
            
            # CulturalHub 시스템으로 데이터 수집
            results = self.cultural_hub_system.run_cultural_hub_integration(
                max_pages=max_pages, 
                use_sequential=use_sequential
            )
            
            if results['total_data_count'] > 0:
                # 증분 수집 모드로 DB에 저장
                save_results = await self._save_to_database_incremental(
                    results['integrated_data'], 
                    incremental=incremental
                )
                
                # 통계 업데이트
                await self._update_collection_stats(results)
                
                total_new = save_results['new_count']
                total_updated = save_results['updated_count'] 
                total_skipped = save_results['skipped_count']
                
                logger.info(f"🎨 CulturalHub 증분 수집 완료: 신규 {total_new}개, 업데이트 {total_updated}개, 중복 스킵 {total_skipped}개")
                
                return {
                    'success': True,
                    'total_collected': results['total_data_count'],
                    'total_new': total_new,
                    'total_updated': total_updated,
                    'total_skipped': total_skipped,
                    'working_apis': results['successful_apis'],
                    'total_apis': results['total_apis'],
                    'success_rate': (results['successful_apis']/results['total_apis'])*100,
                    'api_details': save_results['api_details'],
                    'details': results
                }
            else:
                logger.warning("🎨 CulturalHub에서 수집된 데이터가 없습니다")
                return {
                    'success': False,
                    'total_collected': 0,
                    'total_new': 0,
                    'total_updated': 0,
                    'total_skipped': 0,
                    'working_apis': 0,
                    'total_apis': results.get('total_apis', 0),
                    'success_rate': 0,
                    'message': '수집된 데이터가 없습니다',
                    'details': results
                }
                
        except Exception as e:
            logger.error(f"🎨 CulturalHub 수집 오류: {str(e)}")
            return {
                'success': False,
                'total_collected': 0,
                'total_new': 0,
                'total_updated': 0,
                'total_skipped': 0,
                'working_apis': 0,
                'total_apis': 0,
                'success_rate': 0,
                'message': f'수집 오류: {str(e)}'
            }
    
    async def _save_to_database_incremental(self, integrated_data: List[Dict], incremental: bool = True) -> Dict[str, Any]:
        """🔄 증분 모드로 데이터베이스에 저장 (중복 제거)"""
        save_stats = {
            'new_count': 0,
            'updated_count': 0,
            'skipped_count': 0,
            'api_details': {}
        }
        
        # API 소스별로 데이터 그룹화
        data_by_source = {}
        for item in integrated_data:
            api_source = item.get('api_source', 'unknown')
            if api_source not in data_by_source:
                data_by_source[api_source] = []
            data_by_source[api_source].append(item)
        
        for api_source, items in data_by_source.items():
            logger.info(f"🔄 {api_source} 데이터 처리 중: {len(items)}개")
            
            source_stats = {'new': 0, 'updated': 0, 'skipped': 0}
            
            for item_data in items:
                try:
                    # 기관 정보 확인/생성
                    institution = await self._get_or_create_institution(
                        item_data.get('연계기관명', api_source)
                    )
                    
                    # 중복 검사 및 저장
                    action = await self._process_exhibition_incremental(
                        institution, item_data, incremental
                    )
                    
                    if action == 'created':
                        source_stats['new'] += 1
                        save_stats['new_count'] += 1
                    elif action == 'updated':
                        source_stats['updated'] += 1
                        save_stats['updated_count'] += 1
                    elif action == 'skipped':
                        source_stats['skipped'] += 1
                        save_stats['skipped_count'] += 1
                        
                except Exception as e:
                    logger.error(f"데이터 처리 오류 ({api_source}): {str(e)}")
                    source_stats['skipped'] += 1
                    save_stats['skipped_count'] += 1
            
            save_stats['api_details'][api_source] = source_stats
            logger.info(f"✅ {api_source} 완료: 신규 {source_stats['new']}개, 업데이트 {source_stats['updated']}개, 스킵 {source_stats['skipped']}개")
        
        # 트랜잭션 커밋
        try:
            self.db.commit()
            logger.info("🎨 데이터베이스 저장 완료")
        except Exception as e:
            self.db.rollback()
            logger.error(f"데이터베이스 저장 실패: {str(e)}")
            raise
        
        return save_stats
    
    async def _process_exhibition_incremental(
        self, 
        institution: Institution, 
        data: Dict, 
        incremental: bool = True
    ) -> str:
        """🔄 전시 데이터 증분 처리 (중복 검사 및 업데이트)"""
        
        # 데이터 정규화
        normalized_data = self._normalize_cultural_data(data)
        
        # 중복 검사 기준 설정
        title = normalized_data.get('title', '').strip()
        venue = normalized_data.get('venue', '').strip()
        api_source = normalized_data.get('api_source', '').strip()
        
        if not title:
            return 'skipped'  # 제목이 없으면 스킵
        
        # 중복 검사 쿼리 (여러 조건으로 검사)
        existing_query = self.db.query(Exhibition).filter(
            Exhibition.institution_id == institution.institution_id,
            Exhibition.title == title
        )
        
        # 추가 조건들
        if venue:
            existing_query = existing_query.filter(Exhibition.venue == venue)
        if api_source:
            existing_query = existing_query.filter(Exhibition.api_source == api_source)
        
        existing_exhibition = existing_query.first()
        
        # 외부 ID로도 검사
        external_id = normalized_data.get('external_id')
        if external_id and not existing_exhibition:
            existing_exhibition = self.db.query(Exhibition).filter(
                Exhibition.external_id == external_id,
                Exhibition.api_source == api_source
            ).first()
        
        current_time = datetime.now()
        
        if existing_exhibition:
            if incremental:
                # 증분 모드: 기존 데이터가 있으면 필요시 업데이트
                needs_update = self._needs_update(existing_exhibition, normalized_data)
                
                if needs_update:
                    # 업데이트 수행
                    for key, value in normalized_data.items():
                        if hasattr(existing_exhibition, key) and value is not None:
                            setattr(existing_exhibition, key, value)
                    
                    existing_exhibition.updated_at = current_time
                    existing_exhibition.collected_at = current_time
                    
                    return 'updated'
                else:
                    return 'skipped'  # 업데이트 불필요
            else:
                # 비증분 모드: 기존 데이터 덮어쓰기
                for key, value in normalized_data.items():
                    if hasattr(existing_exhibition, key) and value is not None:
                        setattr(existing_exhibition, key, value)
                
                existing_exhibition.updated_at = current_time
                existing_exhibition.collected_at = current_time
                
                return 'updated'
        else:
            # 새로운 전시 생성
            normalized_data['institution_id'] = institution.institution_id
            normalized_data['created_at'] = current_time
            normalized_data['collected_at'] = current_time
            
            exhibition = Exhibition(**normalized_data)
            self.db.add(exhibition)
            
            return 'created'
    
    def _needs_update(self, existing: Exhibition, new_data: Dict) -> bool:
        """업데이트 필요 여부 판단"""
        # 주요 필드 변경 검사
        key_fields = ['description', 'start_date', 'end_date', 'price', 'website', 'image_url']
        
        for field in key_fields:
            new_value = new_data.get(field)
            existing_value = getattr(existing, field, None)
            
            # 새로운 값이 있고 기존 값과 다르면 업데이트 필요
            if new_value and new_value != existing_value:
                return True
        
        # 마지막 수집 시간이 24시간 이상 지났으면 업데이트
        if existing.collected_at:
            time_diff = datetime.now() - existing.collected_at
            if time_diff.total_seconds() > 86400:  # 24시간
                return True
        
        return False
    
    def _normalize_cultural_data(self, data: Dict) -> Dict[str, Any]:
        """🎨 CulturalHub 데이터 정규화"""
        normalized = {}
        
        # 기본 필드 매핑
        field_mapping = {
            'title': ['제목', 'title', 'subject'],
            'description': ['소개설명', 'description', 'content'],
            'venue': ['장소', 'venue', 'place'],
            'start_date': ['시작일', 'start_date'],
            'end_date': ['종료일', 'end_date'],
            'period': ['기간', 'period'],
            'time_info': ['시간', 'time_info', 'hour'],
            'price': ['관람료할인정보', 'price', 'pay'],
            'contact': ['문의', 'contact', 'tel'],
            'website': ['홈페이지주소', 'website', 'homepage'],
            'image_url': ['이미지주소', 'image_url', 'cover'],
            'category': ['장르', 'category', 'event_gubun'],
            'organizer': ['주최', 'organizer', 'host'],
            'api_source': ['api_source'],
            'external_id': ['전시ID', 'external_id', 'event_seq']
        }
        
        for target_field, source_fields in field_mapping.items():
            for source_field in source_fields:
                if source_field in data and data[source_field]:
                    value = data[source_field]
                    
                    # 날짜 필드 특별 처리
                    if target_field in ['start_date', 'end_date'] and isinstance(value, str):
                        try:
                            # 다양한 날짜 형식 처리
                            value = value.replace('.', '-').replace('/', '-')
                            if len(value) >= 10:
                                normalized[target_field] = datetime.strptime(value[:10], "%Y-%m-%d")
                        except ValueError:
                            normalized[target_field] = None
                    else:
                        # 문자열로 저장
                        normalized[target_field] = str(value).strip() if value else None
                    break
        
        # 필수 필드 기본값 설정
        if not normalized.get('title'):
            normalized['title'] = normalized.get('venue', '제목 없음')
        
        # 메타데이터 추가
        normalized['source'] = 'cultural_hub'
        normalized['is_active'] = True
        
        return normalized
    
    async def _get_or_create_institution(self, name: str) -> Institution:
        """기관 정보 확인/생성"""
        if not name or name.strip() == '':
            name = '정보 없음'
        
        name = name.strip()
        
        # 기존 기관 확인
        existing = self.db.query(Institution).filter(Institution.name == name).first()
        
        if existing:
            return existing
        
        # 새 기관 생성
        institution = Institution(
            name=name,
            source='cultural_hub',
            created_at=datetime.now()
        )
        self.db.add(institution)
        self.db.flush()  # ID 생성을 위해 flush
        
        return institution
    
    async def test_all_cultural_apis(self, quick_test: bool = True) -> Dict[str, Any]:
        """🎨 CulturalHub 15개 API 연결 테스트"""
        try:
            logger.info("🎨 CulturalHub API 테스트 시작")
            
            # 빠른 테스트 모드
            max_pages = 1 if quick_test else 3
            
            # CulturalHub 시스템으로 테스트
            results = self.cultural_hub_system.run_cultural_hub_integration(
                max_pages=max_pages,
                use_sequential=True
            )
            
            return {
                'success': results['success'],
                'total_apis': results.get('total_apis', 0),
                'working_apis': results.get('successful_apis', 0),
                'success_rate': (results.get('successful_apis', 0) / results.get('total_apis', 1)) * 100,
                'test_data_count': results.get('total_data_count', 0),
                'details': results.get('collection_stats', {}),
                'message': f"테스트 완료: {results.get('successful_apis', 0)}/{results.get('total_apis', 0)}개 API 성공"
            }
            
        except Exception as e:
            logger.error(f"🎨 CulturalHub API 테스트 실패: {str(e)}")
            return {
                'success': False,
                'total_apis': 0,
                'working_apis': 0,
                'success_rate': 0,
                'test_data_count': 0,
                'message': f'테스트 실패: {str(e)}'
            }
    
    async def sync_specific_source(
        self, 
        source_name: Optional[str] = None, 
        force_update: bool = False
    ) -> Dict[str, Any]:
        """특정 소스 데이터 동기화"""
        try:
            logger.info(f"🔄 {'전체' if not source_name else source_name} 동기화 시작")
            
            # 전체 수집 후 특정 소스만 필터링
            results = self.cultural_hub_system.run_cultural_hub_integration(
                max_pages=5,
                use_sequential=True
            )
            
            if source_name:
                # 특정 소스만 필터링
                filtered_data = [
                    item for item in results.get('integrated_data', [])
                    if item.get('api_source') == source_name
                ]
                
                if filtered_data:
                    sync_results = await self._save_to_database_incremental(
                        filtered_data, incremental=not force_update
                    )
                    
                    return {
                        'synced_count': len(filtered_data),
                        'updated_count': sync_results['updated_count'],
                        'new_count': sync_results['new_count'],
                        'details': sync_results
                    }
                else:
                    return {
                        'synced_count': 0,
                        'updated_count': 0,
                        'new_count': 0,
                        'message': f'{source_name} 소스에서 데이터를 찾을 수 없습니다'
                    }
            else:
                # 전체 동기화
                sync_results = await self._save_to_database_incremental(
                    results.get('integrated_data', []), 
                    incremental=not force_update
                )
                
                return {
                    'synced_count': results.get('total_data_count', 0),
                    'updated_count': sync_results['updated_count'],
                    'new_count': sync_results['new_count'],
                    'details': sync_results
                }
                
        except Exception as e:
            logger.error(f"동기화 실패: {str(e)}")
            return {
                'synced_count': 0,
                'updated_count': 0,
                'new_count': 0,
                'error': str(e)
            }
    
    async def _update_collection_stats(self, results: Dict) -> None:
        """수집 통계 업데이트"""
        try:
            # 데이터 소스 정보 업데이트
            for api_name in results.get('collection_stats', {}).keys():
                stmt = select(DataSource).where(DataSource.name.like(f"%{api_name}%"))
                result = self.db.execute(stmt)
                data_source = result.scalar_one_or_none()
                
                if data_source:
                    data_source.last_collected_at = datetime.now()
                    data_source.total_records = results['collection_stats'][api_name].get('count', 0)
                    data_source.success_rate = 100.0
                    data_source.status = 'active'
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"통계 업데이트 실패: {str(e)}")
            self.db.rollback()


# 스케줄러 함수들
async def schedule_cultural_hub_collection(db: Session):
    """🎨 정기 CulturalHub 데이터 수집 실행"""
    service = CulturalHubExhibitionService(db)
    return await service.collect_all_exhibitions_safely()


async def get_cultural_hub_status(db: Session):
    """🎨 CulturalHub 수집 현황 조회"""
    service = CulturalHubExhibitionService(db)
    return await service.get_collection_status()


def setup_cultural_data_sources(db: Session):
    """🎨 문화 데이터 소스 초기 설정"""
    sources = [
        {
            "name": "예술의전당",
            "source_type": "api",
            "description": "예술의전당 전시정보 (공연장 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/API_CCA_149/request"
        },
        {
            "name": "대한민국역사박물관",
            "source_type": "api",
            "description": "대한민국역사박물관 특별전시 (국립박물관 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/meta2020/getMCHBspecial"
        },
        {
            "name": "국립한글박물관",
            "source_type": "api",
            "description": "국립한글박물관 전시정보 (국립박물관 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/meta2020/getNHMBex"
        },
        {
            "name": "한국문화예술회관연합회",
            "source_type": "api",
            "description": "한국문화예술회관연합회 공연전시정보 (문화예술회관 / 전국)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/meta2020/getKOCAperf"
        },
        {
            "name": "한국공예디자인문화진흥원",
            "source_type": "api",
            "description": "한국공예디자인문화진흥원 전시도록 (진흥원 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/meta8/getKCDA1503"
        },
        {
            "name": "한국문화예술위원회",
            "source_type": "api",
            "description": "한국문화예술위원회 아르코미술관전시 (미술관 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/meta4/getARKA1202"
        },
        {
            "name": "전주시",
            "source_type": "api",
            "description": "전주시 공연전시정보 (지방자치단체 / 전주)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/other/getJEON5201"
        },
        {
            "name": "서울시립미술관",
            "source_type": "api",
            "description": "서울시립미술관 전시정보 (시립미술관 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/other/getSEMN5601"
        },
        {
            "name": "마포문화재단",
            "source_type": "api",
            "description": "마포문화재단 마포아트센터공연전시 (문화재단 / 서울 마포)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/other/getMAPN0701"
        },
        {
            "name": "국립현대미술관",
            "source_type": "api",
            "description": "국립현대미술관 전시정보 (국립미술관 / 서울/과천/덕수궁/청주)",
            "api_endpoint": "https://api.kcisa.kr/openapi/service/rest/moca/docMeta"
        },
        {
            "name": "한국문화정보원",
            "source_type": "api",
            "description": "한국문화정보원 외 전시정보(통합) (통합정보원 / 전국)",
            "api_endpoint": "https://api.kcisa.kr/openapi/API_CCA_145/request"
        },
        {
            "name": "한국문화정보원_배리어프리",
            "source_type": "api",
            "description": "한국문화정보원 전국 문화예술관광지 배리어프리 정보 (정보원 / 전국)",
            "api_endpoint": "https://api.kcisa.kr/openapi/API_TOU_049/request"
        },
        {
            "name": "국립중앙박물관",
            "source_type": "api",
            "description": "국립중앙박물관 외 전시도록 (국립박물관 / 서울)",
            "api_endpoint": "https://api.kcisa.kr/API_CNV_049/request"
        },
        {
            "name": "제주문화예술진흥원",
            "source_type": "api",
            "description": "제주문화예술진흥원 공연/전시 정보 (지역진흥원 / 제주)",
            "api_endpoint": "http://www.jeju.go.kr/rest/JejuExhibitionService/getJejucultureExhibitionList"
        },
        {
            "name": "대구광역시",
            "source_type": "api",
            "description": "대구광역시 공연·전시 정보 (광역시 / 대구)",
            "api_endpoint": "https://dgfca.or.kr/api/daegu/cultural-events"
        }
    ]
    
    for source_data in sources:
        # 기존 소스 확인
        stmt = select(DataSource).where(DataSource.name == source_data["name"])
        result = db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if not existing:
            source = DataSource(**source_data)
            db.add(source)
    
    db.commit()
    logger.info("🎨 CulturalHub 데이터 소스 설정 완료") 