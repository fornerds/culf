"""
CulturalHub! 전시 데이터 수집 서비스
15개 문화기관 API 모두 안전하게 중앙 집중화하는 문화 허브 시스템을 기존 도메인에 통합
증분 수집으로 중복 없이 새로운 데이터만 추가
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple, Callable
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
import sys
import os
from pathlib import Path

# CulturalHub 시스템 임포트
sys.path.append(str(Path(__file__).parent))
from cultural_hub_ai_system import CulturalHubAPISystem, DEFAULT_MAX_PAGES

from app.domains.exhibition.models import CultureHub, ApiSource
from app.core.config import settings

logger = logging.getLogger(__name__)


class CulturalHubExhibitionService:
    """CulturalHub 전시 데이터 수집 서비스 - 중복 없는 증분 수집"""
    
    def __init__(self, db: Session):
        self.db = db
        self.cultural_hub_system = CulturalHubAPISystem()
        
    async def collect_all_exhibitions_safely(
        self, 
        max_pages: int = DEFAULT_MAX_PAGES,  # 모든 데이터 수집하도록 기본값 증가
        use_sequential: bool = True,
        incremental: bool = True,
        progress_callback: Optional[Callable[[int, str, Optional[Dict]], None]] = None,
        cancel_check: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """16개 문화기관 API 모두에서 안전하게 전시 데이터 수집 (중복 제거)"""
        try:
            logger.info("CulturalHub 증분 데이터 수집 시작")
            
            if progress_callback:
                progress_callback(3, "데이터 소스 초기화 중...", None)
            
            # 디버깅: CulturalHubExhibitionService에서 max_pages 값 확인
            logger.info(f"DEBUG cultural_hub_service.py: max_pages={max_pages}")
            
            if progress_callback:
                progress_callback(4, f"문화 데이터 수집 시작... (최대 {max_pages}페이지, {'순차' if use_sequential else '병렬'} 방식)", None)
            
            # CulturalHub 시스템으로 데이터 수집 (취소 확인 포함)
            results = self.cultural_hub_system.run_cultural_hub_integration(
                max_pages=max_pages, 
                use_sequential=use_sequential,
                progress_callback=progress_callback,
                cancel_check=cancel_check
            )
            
            if results['total_data_count'] > 0:
                if progress_callback:
                    if not progress_callback(5, "수집된 데이터 검증 중...", None):
                        logger.info("데이터 수집이 취소되었습니다 (검증 단계)")
                        return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
                
                if progress_callback:
                    if not progress_callback(6, "중복 데이터 확인 중...", None):
                        logger.info("데이터 수집이 취소되었습니다 (중복 확인 단계)")
                        return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
                
                # 증분 수집 모드로 DB에 저장
                save_results = await self._save_to_database_incremental(
                    results['integrated_data'], 
                    incremental=incremental
                )
                
                if progress_callback:
                    if not progress_callback(7, "데이터베이스 저장 중...", None):
                        logger.info("데이터 수집이 취소되었습니다 (저장 단계)")
                        return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
                
                # 통계 업데이트
                await self._update_collection_stats(results)
                
                total_new = save_results['new_count']
                total_updated = save_results['updated_count'] 
                total_skipped = save_results['skipped_count']
                
                logger.info(f"CulturalHub 증분 수집 완료: 신규 {total_new}개, 업데이트 {total_updated}개, 중복 스킵 {total_skipped}개")
                
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
                logger.warning("CulturalHub에서 수집된 데이터가 없습니다")
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
            logger.error(f"CulturalHub 수집 오류: {str(e)}")
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

    async def collect_single_api_safely(
        self,
        api_key: str,
        max_pages: int = DEFAULT_MAX_PAGES,
        use_sequential: bool = True,
        incremental: bool = True,
        progress_callback: Optional[Callable[[int, str, Optional[Dict]], None]] = None,
        cancel_check: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """개별 API에서 안전하게 데이터 수집"""
        try:
            logger.info(f"개별 API 수집 시작: {api_key}")
            
            if progress_callback:
                progress_callback(1, f"{api_key} 데이터 수집 시작...", None)
            
            # API 설정 확인
            if api_key not in self.cultural_hub_system.cultural_api_config:
                error_msg = f"지원하지 않는 API 키: {api_key}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "message": error_msg,
                    "api_key": api_key
                }
            
            config = self.cultural_hub_system.cultural_api_config[api_key]
            
            if progress_callback:
                if not progress_callback(2, f"{config['name']} API 테스트 중...", None):
                    return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
            
            # API 테스트
            success, total_count, message = self.cultural_hub_system.test_cultural_api_safely(
                api_key, config, cancel_check
            )
            
            if not success:
                error_msg = f"{config['name']} API 테스트 실패: {message}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "message": error_msg,
                    "api_key": api_key
                }
            
            if progress_callback:
                if not progress_callback(3, f"{config['name']} 데이터 수집 중...", None):
                    return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
            
            # 데이터 수집
            raw_data = self.cultural_hub_system.collect_cultural_data_safely(
                api_key, config, max_pages, cancel_check
            )
            
            if not raw_data:
                return {
                    "success": False,
                    "message": f"{config['name']}에서 데이터를 수집하지 못했습니다",
                    "api_key": api_key
                }
            
            if progress_callback:
                if not progress_callback(4, f"{config['name']} 데이터 정규화 중...", None):
                    return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
            
            # 데이터 정규화
            normalized_data = self.cultural_hub_system.normalize_cultural_data(raw_data, api_key, config)
            
            if not normalized_data:
                return {
                    "success": False,
                    "message": f"{config['name']} 데이터 정규화 실패",
                    "api_key": api_key
                }
            
            if progress_callback:
                if not progress_callback(5, f"{config['name']} 데이터베이스 저장 중...", None):
                    return {"success": False, "message": "사용자에 의해 취소됨", "cancelled": True}
            
            # 데이터베이스 저장
            save_results = await self._save_to_database_incremental(normalized_data, incremental)
            
            logger.info(f"{config['name']} 개별 수집 완료: 신규 {save_results['new_count']}개, 업데이트 {save_results['updated_count']}개")
            
            return {
                "success": True,
                "message": f"{config['name']} 수집 완료",
                "api_key": api_key,
                "api_name": config['name'],
                "total_new": save_results['new_count'],
                "total_updated": save_results['updated_count'],
                "total_skipped": save_results['skipped_count'],
                "total_collected": len(normalized_data)
            }
            
        except Exception as e:
            error_msg = f"{api_key} 개별 수집 실패: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg,
                "api_key": api_key
            }
    
    async def _save_to_database_incremental(self, integrated_data: List[Dict], incremental: bool = True) -> Dict[str, Any]:
        """증분 모드로 데이터베이스에 저장 (중복 제거)"""
        save_stats = {
            'new_count': 0,
            'updated_count': 0,
            'skipped_count': 0,
            'api_details': {}
        }
        
        # API 소스별로 데이터 그룹화
        data_by_source = {}
        source_field_debug = {}  # 디버깅용
        
        # 디버깅: 첫 번째 데이터 샘플 확인
        if integrated_data:
            logger.info(f"첫 번째 데이터 샘플: {integrated_data[0]}")
            logger.info(f"데이터 키들: {list(integrated_data[0].keys())}")
        
        for item in integrated_data:
            # 다양한 소스 필드명 확인
            api_source = item.get('api_key', item.get('data_source', item.get('api_source', 'unknown')))
            
            # 디버깅: 실제 소스 필드 값들 확인
            if api_source not in source_field_debug:
                source_field_debug[api_source] = {
                    'api_key': item.get('api_key'),
                    'data_source': item.get('data_source'), 
                    'api_source': item.get('api_source'),
                    'count': 0,
                    'sample_keys': list(item.keys())[:10]  # 첫 10개 키만
                }
            source_field_debug[api_source]['count'] += 1
            
            if api_source not in data_by_source:
                data_by_source[api_source] = []
            data_by_source[api_source].append(item)
        
        logger.info(f"총 {len(integrated_data)}개 데이터를 {len(data_by_source)}개 소스로 그룹화")
        logger.info(f"소스별 필드 디버깅: {source_field_debug}")
        
        for api_source, items in data_by_source.items():
            logger.info(f"{api_source} 데이터 처리 중: {len(items)}개")
            
            # 첫 번째 아이템의 상세 정보 로깅
            if items:
                first_item = items[0]
                logger.info(f"{api_source} 첫 번째 아이템 샘플:")
                logger.info(f"  - 제목 관련: {first_item.get('제목', first_item.get('title', first_item.get('subject', '없음')))}")
                logger.info(f"  - 장소 관련: {first_item.get('장소', first_item.get('venue', first_item.get('place', '없음')))}")
                logger.info(f"  - 기관 관련: {first_item.get('연계기관명', first_item.get('기관명', first_item.get('장소', '없음')))}")
            
            source_stats = {'new': 0, 'updated': 0, 'skipped': 0}
            
            # 배치 내 중복 제거 - culture_code 기준
            seen_culture_codes = set()
            unique_items = []
            
            for item_data in items:
                # 다양한 필드명에서 culture_code 찾기
                culture_code = str(item_data.get('culture_code', 
                                  item_data.get('external_id',
                                  item_data.get('전시ID', 
                                  item_data.get('event_seq',
                                  item_data.get('LOCAL_ID',
                                  item_data.get('I_ID', '')))))))
                
                # 다양한 필드명에서 title 찾기
                title = item_data.get('제목', 
                       item_data.get('title', 
                       item_data.get('subject',
                       item_data.get('TITLE',
                       item_data.get('I_TITLE', '')))))
                
                # 다양한 필드명에서 venue 찾기
                venue = item_data.get('장소', 
                       item_data.get('venue', 
                       item_data.get('place',
                       item_data.get('EVENT_SITE', ''))))
                
                # culture_code가 없거나 빈 문자열인 경우, 제목과 장소를 사용하여 고유 키 생성
                if not culture_code or culture_code == '':
                    batch_key = f"{api_source}:{title}:{venue}"
                else:
                    batch_key = f"{api_source}:{culture_code}"
                
                # 배치 내에서 이미 처리된 아이템인지 확인
                if batch_key in seen_culture_codes:
                    logger.info(f"배치 내 중복 제거: {batch_key}")
                    source_stats['skipped'] += 1
                    save_stats['skipped_count'] += 1
                    continue
                
                seen_culture_codes.add(batch_key)
                unique_items.append(item_data)
            
            logger.info(f"{api_source}: 배치 내 중복 제거 후 {len(unique_items)}개 (원본: {len(items)}개)")
            
            for item_data in unique_items:
                try:
                    # 디버그: 처리 전 데이터 확인
                    logger.info(f"처리할 데이터: title='{item_data.get('제목')}', api_source='{item_data.get('api_source')}'")
                    
                    # 중복 검사 및 저장 (Institution 없이 직접 처리)
                    action = await self._process_exhibition_incremental(
                        item_data, incremental
                    )
                    
                    if action == 'added':
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
                    # 트랜잭션 오류 시 롤백 후 재시작
                    try:
                        self.db.rollback()
                        self.db.begin()
                    except Exception as rollback_error:
                        logger.error(f"트랜잭션 롤백 실패: {str(rollback_error)}")
                    source_stats['skipped'] += 1
                    save_stats['skipped_count'] += 1
            
            # api_details에 success 필드 추가 (스킵된 데이터도 성공으로 처리)
            total_processed = source_stats['new'] + source_stats['updated'] + source_stats['skipped']
            save_stats['api_details'][api_source] = {
                'success': total_processed > 0,  # 처리된 데이터가 있으면 성공
                'new_count': source_stats['new'],
                'updated_count': source_stats['updated'],
                'skipped_count': source_stats['skipped'],
                'name': api_source
            }
            logger.info(f"{api_source} 완료: 신규 {source_stats['new']}개, 업데이트 {source_stats['updated']}개, 스킵 {source_stats['skipped']}개")
        
        # 트랜잭션 커밋
        try:
            self.db.commit()
            logger.info("데이터베이스 저장 완료")
        except Exception as e:
            self.db.rollback()
            logger.error(f"데이터베이스 저장 실패: {str(e)}")
            raise
        
        return save_stats
    
    async def _process_exhibition_incremental(
        self, 
        data: Dict, 
        incremental: bool = True
    ) -> str:
        """전시 데이터 증분 처리 (중복 검사 및 업데이트)"""
        
        # 현재 시간 설정
        current_time = datetime.now()
        
        # 데이터 정규화
        normalized_data = self._normalize_cultural_data(data)
        
        # 중복 검사 기준 설정
        title = normalized_data.get('title', '').strip()
        venue = normalized_data.get('venue', '').strip()
        source = normalized_data.get('api_source', '').strip()  # api_source 사용
        
        logger.info(f"중복 검사 중: title='{title}', venue='{venue}', source='{source}'")
        
        if not title:
            logger.info("제목이 없어서 스킵")
            return 'skipped'  # 제목이 없으면 스킵
        
        # 중복 검사 - culture_code 우선 검사 (더 정확함)
        culture_code = normalized_data.get('culture_code')
        existing_exhibition = None
        
        # 1차 검사: Culture Code가 있으면 우선 검사 (가장 정확)
        if culture_code:
            existing_exhibition = self.db.query(CultureHub).filter(
                CultureHub.culture_code == culture_code,
                CultureHub.api_source == source
            ).first()
        if existing_exhibition:
                logger.debug(f"Culture Code로 기존 데이터 발견: {culture_code}")
        
        # 2차 검사: Culture Code가 없거나 발견되지 않은 경우만 Title로 검사
        if not existing_exhibition:
            existing_exhibition = self.db.query(CultureHub).filter(
                CultureHub.api_source == source,  # API 소스 필수
                CultureHub.title == title
            ).first()
        if existing_exhibition:
                logger.debug(f"Title로 기존 데이터 발견: {title}")
        
        # 중복 데이터 처리
        if existing_exhibition:
            if incremental and self._needs_update(existing_exhibition, normalized_data):
                # 업데이트 필요한 경우
                for key, value in normalized_data.items():
                    if hasattr(existing_exhibition, key):
                        setattr(existing_exhibition, key, value)
                
                existing_exhibition.updated_at = current_time
                existing_exhibition.collected_at = current_time
                
                logger.info(f"기존 데이터 업데이트: {title}")
                return 'updated'
            else:
                # 업데이트 불필요한 경우
                logger.debug(f"업데이트 불필요: {title}")
                return 'skipped'
        
        # 새 데이터 생성
        try:
            # CultureHub 객체 생성
            new_exhibition = CultureHub(
                **normalized_data,
                collected_at=current_time,
                created_at=current_time,
                updated_at=current_time
            )
            
            self.db.add(new_exhibition)
            logger.info(f"새 데이터 추가: {title}")
            return 'added'
            
        except Exception as e:
            logger.error(f"데이터 생성 실패: {title} - {str(e)}")
            return 'error'
    
    def _needs_update(self, existing: CultureHub, new_data: Dict) -> bool:
        """업데이트 필요 여부 판단"""
        # 주요 필드 변경 검사 - 간소화된 모델의 중요한 정보 필드
        key_fields = [
            # 기본 정보
            'title', 'description',
            # 기간 정보
            'start_date', 'end_date', 'period',
            # 장소 정보
            'venue',
            # 카테고리
            'category',
            # 참여자 정보
            'artist',
            # 요금 정보
            'price',
            # 웹사이트/URL
            'website',
            # 이미지
            'image_url'
        ]
        
        for field in key_fields:
            new_value = new_data.get(field)
            existing_value = getattr(existing, field, None)
            
            # 새로운 값이 있고 기존 값과 다르면 업데이트 필요
            if new_value and new_value != existing_value:
                return True
        
        # 마지막 수집 시간이 24시간 이상 지났으면 업데이트
        if existing.collected_at:
            try:
                # timezone 문제 해결
                current_time = datetime.now()
                if hasattr(existing.collected_at, 'tzinfo') and existing.collected_at.tzinfo is not None:
                    # collected_at이 timezone-aware인 경우
                    from datetime import timezone
                    current_time = current_time.replace(tzinfo=timezone.utc)
                    # collected_at을 UTC로 변환
                    collected_at_utc = existing.collected_at.astimezone(timezone.utc).replace(tzinfo=None)
                    current_time = current_time.replace(tzinfo=None)
                    time_diff = current_time - collected_at_utc
                else:
                    # collected_at이 timezone-naive인 경우
                    time_diff = current_time - existing.collected_at
                
                if time_diff.total_seconds() > 86400:  # 24시간
                    return True
            except Exception as e:
                logger.warning(f"날짜 비교 중 오류 발생: {e}, 업데이트 진행")
                return True
        
        return False
    
    def _normalize_cultural_data(self, data: Dict) -> Dict[str, Any]:
        """CulturalHub 데이터 정규화"""
        normalized = {}
        
        # 기본 필드 매핑
        field_mapping = {
            'title': ['제목', 'title', 'subject'],
            'subtitle': ['부제목', 'subtitle', 'sub_title'],
            'description': ['소개설명', 'description', 'content'],
            'venue': ['장소', 'venue', 'place'],
            'start_date': ['시작일', 'start_date'],
            'end_date': ['종료일', 'end_date'],
            'period': ['기간', 'period'],
            'time': ['시간', 'time_info', 'hour'],
            'price': ['관람료할인정보', 'price', 'pay'],
            'contact': ['문의', 'contact', 'tel'],
            'website': ['홈페이지주소', 'website', 'homepage'],
            'image_url': ['이미지주소', 'image_url', 'cover'],
            'category': ['장르', 'category', 'event_gubun'],
            'genre': ['분류', 'genre', 'classification'],
            'artist': ['작가', 'artist', 'author'],
            'creator': ['작가', 'creator', 'artist_name'],
            'host': ['주최', 'organizer', 'host', '수집처'],
            'culture_code': ['전시ID', 'external_id', 'event_seq', 'LOCAL_ID', 'I_ID', 'rowid', 'seq']
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
                                normalized[target_field] = datetime.strptime(value[:10], "%Y-%m-%d").date()
                        except ValueError:
                            normalized[target_field] = None
                    else:
                        # 문자열로 저장 (길이 제한 적용)
                        if value:
                            value_str = str(value).strip()
                            # 필드별 최대 길이 제한
                            max_lengths = {
                                'title': 200,
                                'subtitle': 200,
                                'venue': 200,
                                'category': 100,
                                'genre': 100,
                                'artist': 200,
                                'creator': 200,
                                'host': 200,
                                'contact': 100,
                                'website': 500,
                                'image_url': 500,
                                'url': 500,
                                'price': 100,
                                'address': 200,
                                'phone': 50,
                                'time': 100,
                                'period': 100,
                                'audience': 100,
                                'status': 50,
                                'keywords': 200,
                                'charge': 100,
                                'cover': 500
                            }
                            max_len = max_lengths.get(target_field, 200)
                            if len(value_str) > max_len:
                                logger.warning(f"필드 '{target_field}' 값이 {max_len}자를 초과하여 잘림: {value_str[:50]}...")
                                value_str = value_str[:max_len]
                            normalized[target_field] = value_str
                        else:
                            normalized[target_field] = None
                    break
        
        # 필수 필드 기본값 설정
        if not normalized.get('title'):
            normalized['title'] = normalized.get('venue', '제목 없음')
        
        # 예술의전당 특별 처리: DESCRIPTION에서 장소 정보 추출
        if not normalized.get('venue') and data.get('api_source') == '예술의전당 전시정보':
            description = normalized.get('description') or data.get('소개설명', '')
            if description and isinstance(description, str):
                # "장소: ..." 패턴으로 장소 정보 추출
                lines = description.split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('장소:'):
                        venue_info = line.replace('장소:', '').strip()
                        if venue_info:
                            # 길이 제한 적용
                            if len(venue_info) > 200:
                                venue_info = venue_info[:200]
                            normalized['venue'] = venue_info
                            logger.info(f"DESCRIPTION에서 장소 정보 추출: {venue_info}")
                            break
        
        # 예술의전당 특별 처리: DESCRIPTION에서 가격 정보 추출
        if not normalized.get('price') and data.get('api_source') == '예술의전당 전시정보':
            description = normalized.get('description') or data.get('소개설명', '')
            if description and isinstance(description, str):
                lines = description.split('\n')
                for line in lines:
                    line = line.strip()
                    if line.startswith('가격:') or line.startswith('입장료:') or line.startswith('관람료:'):
                        price_info = line.split(':', 1)[1].strip() if ':' in line else ''
                        if price_info:
                            # 길이 제한 적용
                            if len(price_info) > 100:
                                price_info = price_info[:100]
                            normalized['price'] = price_info
                            logger.info(f"DESCRIPTION에서 가격 정보 추출: {price_info}")
                            break
        
        # 예술의전당 특별 처리: 제목에서 작가 정보 추출
        if not normalized.get('artist') and data.get('api_source') == '예술의전당 전시정보':
            title = normalized.get('title', '')
            if title and isinstance(title, str) and ':' in title:
                # "작가명: 전시제목" 형태에서 작가명 추출
                artist_name = title.split(':', 1)[0].strip()
                if artist_name and artist_name != title:  # 전체 제목과 다를 때만
                    # 길이 제한 적용
                    if len(artist_name) > 200:
                        artist_name = artist_name[:200]
                    normalized['artist'] = artist_name
                    logger.info(f"제목에서 작가 정보 추출: {artist_name}")
        
        # 예술의전당 특별 처리: DESCRIPTION에서 추가 작가 정보 추출
        if normalized.get('artist') and data.get('api_source') == '예술의전당 전시정보':
            description = normalized.get('description') or data.get('소개설명', '')
            if description and isinstance(description, str):
                import re
                lines = description.split('\n')
                for line in lines:
                    line = line.strip()
                    # 패턴: "작가명 (연도 – 연도)" 형태로 생몰년 정보가 있는 경우
                    match = re.search(r'^([가-힣a-zA-Z\s]+)\s*\((\d{4})\s*[–-]\s*(\d{4})\)', line)
                    if match:
                        detailed_artist = match.group(1).strip()
                        birth_year = match.group(2)
                        death_year = match.group(3)
                        if detailed_artist == normalized.get('artist'):
                            # 생몰년 정보가 포함된 상세 작가 정보로 업데이트
                            full_artist_info = f"{detailed_artist} ({birth_year}-{death_year})"
                            if len(full_artist_info) <= 200:
                                normalized['artist'] = full_artist_info
                                logger.info(f"작가 정보에 생몰년 추가: {full_artist_info}")
                            break
        
        # 대한민국역사박물관 특별 처리: 기본 필드 보완
        if data.get('api_source') == '대한민국역사박물관 특별전시':
            # venue가 None인 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '대한민국역사박물관'
                logger.info(f"대한민국역사박물관: venue를 기관명으로 설정")
            
            # description이 None인 경우 제목 기반으로 간단한 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                if title:
                    normalized['description'] = f"{title} - 대한민국역사박물관 특별전시"
                    logger.info(f"대한민국역사박물관: description 자동 생성")
            
            # 요금 정보가 없는 경우 박물관 기본 정보로 설정
            if not normalized.get('price'):
                normalized['price'] = '무료 (일반 관람료 별도)'
                logger.info(f"대한민국역사박물관: price 기본값 설정")
        
        # 국립한글박물관 특별 처리: 아카이브 데이터 보완
        if data.get('api_source') == '국립한글박물관 전시정보':
            # venue가 None인 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '국립한글박물관'
                logger.info(f"국립한글박물관: venue를 기관명으로 설정")
            
            # description이 None인 경우 제목 기반으로 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                if title:
                    # 한글 고문서/언해서 등의 특성 반영
                    normalized['description'] = f"{title} - 국립한글박물관 소장 한글 아카이브"
                    logger.info(f"국립한글박물관: description 자동 생성")
            
            # 요금 정보 설정
            if not normalized.get('price'):
                normalized['price'] = '무료 (박물관 일반 관람료 별도)'
                logger.info(f"국립한글박물관: price 기본값 설정")
            
            # 카테고리 보완 - 아카이브 데이터임을 명시
            if normalized.get('genre') == '전시':
                normalized['genre'] = '한글아카이브'
                logger.info(f"국립한글박물관: genre를 '한글아카이브'로 변경")
        
        # 한국문화예술회관연합회 특별 처리: 고품질 데이터 정제
        if data.get('api_source') == '한국문화예술회관연합회 공연전시정보':
            # HTML 태그가 포함된 description 정리
            description = normalized.get('description')
            if description and isinstance(description, str):
                import re
                # HTML 태그 제거
                clean_description = re.sub(r'<[^>]+>', '', description)
                # 불필요한 공백 정리
                clean_description = re.sub(r'\s+', ' ', clean_description).strip()
                if clean_description and clean_description != description:
                    normalized['description'] = clean_description
                    logger.info(f"한국문화예술회관연합회: HTML 태그 제거된 description 정리")
            
            # description이 여전히 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                if title:
                    desc_parts = [title]
                    if venue:
                        desc_parts.append(f"({venue})")
                    desc_parts.append("- 한국문화예술회관연합회")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"한국문화예술회관연합회: description 자동 생성")
            
            # 요금 정보가 없는 경우에만 기본값 설정 (이미 좋은 데이터가 많음)
            if not normalized.get('price'):
                normalized['price'] = '문의 필요'
                logger.info(f"한국문화예술회관연합회: price 기본값 설정")
        
        # 한국공예디자인문화진흥원 특별 처리: 전시도록 아카이브 데이터 정제
        if data.get('api_source') == '한국공예디자인문화진흥원 전시도록':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '한국공예디자인문화진흥원'
                logger.info(f"한국공예디자인문화진흥원: venue를 기관명으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                if title:
                    normalized['description'] = f"{title} - 한국공예디자인문화진흥원 전시도록 아카이브"
                    logger.info(f"한국공예디자인문화진흥원: description 자동 생성")
            
            # 요금 정보는 대부분 아카이브이므로 기본값 설정
            if not normalized.get('price'):
                normalized['price'] = '아카이브 자료 (당시 전시 종료)'
                logger.info(f"한국공예디자인문화진흥원: price 기본값 설정")
            
            # 카테고리 보완 - 아카이브 데이터임을 명시
            if normalized.get('genre') == '전시':
                normalized['genre'] = '전시도록아카이브'
                logger.info(f"한국공예디자인문화진흥원: genre를 '전시도록아카이브'로 변경")
        
        # 아르코미술관 특별 처리: 미술관 전시 데이터 정제  
        if data.get('api_source') == '한국문화예술위원회 아르코미술관전시':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '아르코미술관'
                logger.info(f"아르코미술관: venue를 기관명으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                if title:
                    normalized['description'] = f"{title} - 아르코미술관 전시 아카이브"
                    logger.info(f"아르코미술관: description 자동 생성")
            
            # 요금 정보는 대부분 아카이브이므로 기본값 설정
            if not normalized.get('price'):
                normalized['price'] = '아카이브 자료 (당시 전시 종료)'
                logger.info(f"아르코미술관: price 기본값 설정")
            
            # 카테고리 보완 - 미술관 아카이브 데이터임을 명시
            if normalized.get('genre') == '아르코미술관 전시':
                normalized['genre'] = '미술관전시아카이브'
                logger.info(f"아르코미술관: genre를 '미술관전시아카이브'로 변경")
        
        # 전주시 특별 처리: 지역 공연전시 데이터 정제
        if data.get('api_source') == '전주시 공연전시정보':
            # venue가 없는 경우 제목에서 추출 시도
            if not normalized.get('venue'):
                title = normalized.get('title', '')
                if '[' in title and ']' in title:
                    # "[전주전통문화센터]" 형태에서 추출
                    venue_match = title.split(']')[0].replace('[', '').strip()
                    if venue_match:
                        normalized['venue'] = venue_match
                        logger.info(f"전주시: 제목에서 venue 추출: {venue_match}")
                
                # 여전히 없으면 기본값
                if not normalized.get('venue'):
                    normalized['venue'] = '전주시 문화시설'
                    logger.info(f"전주시: venue를 기본값으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                if title:
                    desc_parts = [title]
                    if venue:
                        desc_parts.append(f"({venue})")
                    desc_parts.append("- 전주시 공연전시정보")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"전주시: description 자동 생성")
            
            # 요금 정보가 없는 경우 기본값 설정
            if not normalized.get('price'):
                normalized['price'] = '문의 필요'
                logger.info(f"전주시: price 기본값 설정")
        
        # 서울시립미술관 전시정보 특별 처리: 시립미술관 전시 데이터 정제
        if data.get('api_source') == '서울시립미술관 전시정보':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '서울시립미술관'
                logger.info(f"서울시립미술관: venue를 기관명으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                if title:
                    normalized['description'] = f"{title} - 서울시립미술관 전시 아카이브"
                    logger.info(f"서울시립미술관: description 자동 생성")
            
            # 요금 정보가 없는 경우 기본값 설정 (대부분 무료)
            if not normalized.get('price'):
                normalized['price'] = '무료 (일반 관람료 별도)'
                logger.info(f"서울시립미술관: price 기본값 설정")
            
            # 카테고리 보완 - 시립미술관 아카이브 데이터임을 명시
            if normalized.get('genre') == '전시정보':
                normalized['genre'] = '시립미술관전시아카이브'
                logger.info(f"서울시립미술관: genre를 '시립미술관전시아카이브'로 변경")
        
        # 서울시립미술관 아카이브 특별 처리: 미술관 소장품/도서 아카이브 데이터 정제
        if data.get('api_source') == '서울시립미술관 아카이브':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '서울시립미술관'
                logger.info(f"서울시립미술관 아카이브: venue를 기관명으로 설정")
            
            # description이 없는 경우 소개설명 필드나 기본 설명 생성
            if not normalized.get('description'):
                scope = normalized.get('소개설명', '')
                title = normalized.get('title', '')
                if scope:
                    normalized['description'] = scope
                elif title:
                    normalized['description'] = f"{title} - 서울시립미술관 소장 아카이브"
                    logger.info(f"서울시립미술관 아카이브: description 자동 생성")
            
            # 요금 정보 설정 (아카이브 자료)
            if not normalized.get('price'):
                normalized['price'] = '아카이브 자료'
                logger.info(f"서울시립미술관 아카이브: price 기본값 설정")
            
            # 카테고리 보완 - 아카이브 데이터임을 명시
            if not normalized.get('genre') or normalized.get('genre') == '':
                type_name = normalized.get('자료유형명', '')
                if type_name:
                    normalized['genre'] = f"서울시립미술관{type_name}아카이브"
                else:
                    normalized['genre'] = '서울시립미술관아카이브'
                logger.info(f"서울시립미술관 아카이브: genre 설정")
            
            # 이미지 URL을 전체 URL로 변환
            img_url = normalized.get('이미지URL', '')
            if img_url and not img_url.startswith('http'):
                normalized['image_url'] = f"https://sema.seoul.go.kr{img_url}"
                logger.info(f"서울시립미술관 아카이브: 이미지 URL 완성")
            
            # artist 필드 정리 (작가가 비어있을 수 있음)
            if not normalized.get('artist') or normalized.get('artist') == '':
                normalized['artist'] = None
                
            # 생산일자를 날짜 형식으로 변환 (YYYYMMDD → YYYY-MM-DD)
            prod_date = normalized.get('생산일자', '')
            if prod_date and len(prod_date) == 8 and prod_date.isdigit():
                formatted_date = f"{prod_date[:4]}-{prod_date[4:6]}-{prod_date[6:8]}"
                normalized['start_date'] = formatted_date
                normalized['period'] = formatted_date
                logger.info(f"서울시립미술관 아카이브: 생산일자 포맷 변환")
        
        # 마포아트센터 특별 처리: 지역 아트센터 공연전시 데이터 정제
        if data.get('api_source') == '마포문화재단 마포아트센터공연전시':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '마포아트센터'
                logger.info(f"마포아트센터: venue를 기관명으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                if title:
                    desc_parts = [title]
                    if venue:
                        desc_parts.append(f"({venue})")
                    desc_parts.append("- 마포아트센터 공연전시")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"마포아트센터: description 자동 생성")
            
            # 요금 정보가 없는 경우 기본값 설정
            if not normalized.get('price'):
                normalized['price'] = '문의 필요'
                logger.info(f"마포아트센터: price 기본값 설정")
        
        # 국립현대미술관 특별 처리: 국립미술관 전시 데이터 정제
        if data.get('api_source') == '국립현대미술관 전시정보':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                normalized['venue'] = '국립현대미술관'
                logger.info(f"국립현대미술관: venue를 기관명으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                artist = normalized.get('artist', '')
                if title:
                    desc_parts = [title]
                    if artist:
                        desc_parts.append(f"(작가: {artist})")
                    if venue:
                        desc_parts.append(f"({venue})")
                    desc_parts.append("- 국립현대미술관")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"국립현대미술관: description 자동 생성")
            
            # 요금 정보가 없는 경우 기본값 설정 (국립미술관은 대부분 무료)
            if not normalized.get('price'):
                normalized['price'] = '무료 (상설전시 관람료 별도)'
                logger.info(f"국립현대미술관: price 기본값 설정")
            
            # 카테고리 보완
            if normalized.get('genre') == '전시정보':
                normalized['genre'] = '국립미술관전시'
                logger.info(f"국립현대미술관: genre를 '국립미술관전시'로 변경")
        
        # 통합 전시정보 특별 처리: 한국문화정보원 통합 데이터 정제
        if data.get('api_source') == '한국문화정보원 외 전시정보(통합)':
            # venue가 없는 경우 기관명으로 대체
            if not normalized.get('venue'):
                institution = normalized.get('creator', '')
                if institution:
                    normalized['venue'] = institution
                    logger.info(f"통합전시정보: venue를 기관명으로 설정: {institution}")
                else:
                    normalized['venue'] = '통합전시정보 제공기관'
                    logger.info(f"통합전시정보: venue를 기본값으로 설정")
            
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                institution = normalized.get('creator', '')
                if title:
                    desc_parts = [title]
                    if venue and venue != institution:
                        desc_parts.append(f"({venue})")
                    if institution:
                        desc_parts.append(f"- {institution}")
                    else:
                        desc_parts.append("- 한국문화정보원 통합 전시정보")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"통합전시정보: description 자동 생성")
            
            # 요금 정보가 없는 경우 기본값 설정
            if not normalized.get('price'):
                normalized['price'] = '문의 필요'
                logger.info(f"통합전시정보: price 기본값 설정")
            
            # 카테고리 보완
            if not normalized.get('genre'):
                normalized['genre'] = '통합전시정보'
                logger.info(f"통합전시정보: genre를 '통합전시정보'로 설정")
        
        # 배리어프리 정보 특별 처리: 한국문화정보원 배리어프리 데이터 정제
        if data.get('api_source') == '한국문화정보원 전국 문화예술관광지 배리어프리 정보':
            # 시설정보에서 요금 정보 추출
            facility_info = normalized.get('시설정보', '')
            if facility_info:
                if '입장료 무료' in facility_info:
                    normalized['price'] = '무료'
                    logger.info(f"배리어프리: 시설정보에서 무료 요금 정보 추출")
                elif '입장료 유료' in facility_info:
                    normalized['price'] = '유료'
                    logger.info(f"배리어프리: 시설정보에서 유료 요금 정보 추출")
                else:
                    normalized['price'] = '문의 필요'
                    logger.info(f"배리어프리: price 기본값 설정")
            else:
                normalized['price'] = '문의 필요'
                logger.info(f"배리어프리: price 기본값 설정")
            
            # 작가 정보는 배리어프리 시설 정보에서는 해당 없음
            normalized['artist'] = None
            
            # description 보완 - 운영시간과 시설정보 결합
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                if title:
                    desc_parts = [f"{title} 배리어프리 정보"]
                    if venue:
                        desc_parts.append(f"({venue})")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"배리어프리: description 자동 생성")
            
            # 카테고리 설정
            normalized['genre'] = '배리어프리시설정보'
            logger.info(f"배리어프리: genre를 '배리어프리시설정보'로 설정")
            
            # period 정보가 없으므로 상시 운영으로 설정
            if not normalized.get('period'):
                normalized['period'] = '상시 운영 (휴무일 별도 확인)'
                logger.info(f"배리어프리: period 기본값 설정")
        
        # 제주문화예술진흥원 특별 처리: 지역 공연전시 데이터 정제
        if data.get('api_source') == '제주문화예술진흥원 공연/전시 정보':
            # description이 없는 경우 기본 설명 생성
            if not normalized.get('description'):
                title = normalized.get('title', '')
                venue = normalized.get('venue', '')
                owner = normalized.get('creator', '')  # owner → 연계기관명
                genre = normalized.get('genre', '')
                if title:
                    desc_parts = [title]
                    if genre:
                        desc_parts.append(f"({genre})")
                    if venue:
                        desc_parts.append(f"장소: {venue}")
                    if owner:
                        desc_parts.append(f"주최: {owner}")
                    normalized['description'] = ' '.join(desc_parts)
                    logger.info(f"제주문화예술진흥원: description 자동 생성")
            
            # 작가 정보는 공연/전시 정보에 없으므로 주최자로 대체
            if not normalized.get('artist'):
                owner = normalized.get('creator', '')  # owner → 연계기관명
                if owner and owner != '제주문화예술진흥원':
                    normalized['artist'] = f"{owner} 주최"
                    logger.info(f"제주문화예술진흥원: artist를 주최자로 설정: {owner}")
                else:
                    normalized['artist'] = None
                    logger.info(f"제주문화예술진흥원: artist 정보 없음")
            
            # period 정보 생성 (start + end + hour 결합)
            if not normalized.get('period'):
                start_date = normalized.get('start_date', '')
                end_date = normalized.get('end_date', '')
                time_info = normalized.get('time', '')
                
                if start_date and end_date:
                    # 날짜 타입을 문자열로 변환
                    start_str = str(start_date) if start_date else ''
                    end_str = str(end_date) if end_date else ''
                    
                    if start_str == end_str:
                        period_str = start_str
                    else:
                        period_str = f"{start_str} ~ {end_str}"
                    
                    if time_info:
                        period_str += f" {time_info}"
                    
                    normalized['period'] = period_str
                    logger.info(f"제주문화예술진흥원: period 자동 생성: {period_str}")
            
            # 상태 정보 정리
            status = normalized.get('상태정보', '')
            if status == 'END':
                normalized['status'] = '종료'
                logger.info(f"제주문화예술진흥원: 상태를 '종료'로 설정")
            elif status:
                normalized['status'] = status
        
        # 대구광역시 특별 처리: 광역시 공연전시 데이터 정제
        if data.get('api_source') == '대구광역시 공연전시정보':
            import re
            
            # HTML 태그가 포함된 description 정리
            description = normalized.get('description', '')
            if description and isinstance(description, str):
                # HTML 태그 제거
                clean_description = re.sub(r'<[^>]+>', ' ', description)
                # HTML 엔티티 디코딩
                clean_description = clean_description.replace('&lt;', '<').replace('&gt;', '>')
                # 불필요한 공백 정리
                clean_description = re.sub(r'\s+', ' ', clean_description).strip()
                
                # 너무 긴 설명은 적절히 요약 (200자 제한)
                if len(clean_description) > 200:
                    clean_description = clean_description[:200] + "..."
                
                normalized['description'] = clean_description
                logger.info(f"대구광역시: HTML 태그 제거 및 설명 정리 완료")
            
            # 작가 정보 처리 - host가 공백이면 지역 정보 활용
            if not normalized.get('artist'):
                host = normalized.get('host', '').strip()
                area = normalized.get('지역', '')
                
                if host:
                    normalized['artist'] = host
                    logger.info(f"대구광역시: artist를 주최자로 설정: {host}")
                elif area:
                    normalized['artist'] = f"{area} 지역 문화행사"
                    logger.info(f"대구광역시: artist를 지역으로 설정: {area}")
                else:
                    normalized['artist'] = "대구광역시 문화행사"
                    logger.info(f"대구광역시: artist를 기본값으로 설정")
            
            # period 정보 생성 (start_date + end_date 결합)
            if not normalized.get('period'):
                start_date = normalized.get('start_date', '')
                end_date = normalized.get('end_date', '')
                
                if start_date and end_date:
                    # 날짜 타입을 문자열로 변환
                    start_str = str(start_date) if start_date else ''
                    end_str = str(end_date) if end_date else ''
                    
                    if start_str == end_str:
                        period_str = start_str
                    else:
                        period_str = f"{start_str} ~ {end_str}"
                    
                    normalized['period'] = period_str
                    logger.info(f"대구광역시: period 자동 생성: {period_str}")
            
            # 장소 정보 보완 (place + event_area 결합)
            venue = normalized.get('venue', '').strip()
            area = normalized.get('지역', '')
            if venue and area and area not in venue:
                normalized['venue'] = f"{venue} ({area})"
                logger.info(f"대구광역시: venue에 지역 정보 추가: {normalized['venue']}")
            
            # 요금 정보 정리
            pay_gubun = normalized.get('유료무료', '')
            pay_detail = normalized.get('price', '')
            if pay_gubun and pay_detail:
                normalized['price'] = f"{pay_gubun} - {pay_detail}"
                logger.info(f"대구광역시: 요금 정보 통합: {normalized['price']}")
            elif pay_gubun:
                normalized['price'] = pay_gubun
                logger.info(f"대구광역시: 요금 정보 기본값: {pay_gubun}")
            
            # 장르 정보 정리
            genre = normalized.get('genre', '')
            if genre == '공연':
                normalized['genre'] = '대구광역시공연'
                logger.info(f"대구광역시: genre를 '대구광역시공연'으로 설정")
            elif genre == '전시':
                normalized['genre'] = '대구광역시전시'
                logger.info(f"대구광역시: genre를 '대구광역시전시'로 설정")
        
        # 메타데이터 추가
        normalized['api_source'] = data.get('api_source', data.get('data_source', data.get('api_key', 'unknown')))
        normalized['is_active'] = True
        
        # creator 필드를 artist 필드로 매핑 (CultureHub 모델에는 creator 필드가 없음)
        if 'creator' in normalized and not normalized.get('artist'):
            normalized['artist'] = normalized['creator']
            logger.debug(f"creator 필드를 artist로 매핑: {normalized['creator']}")
        
        # CultureHub 모델에 없는 필드 제거 (간소화된 모델에 맞춤)
        model_fields = {
            'title', 'description', 'start_date', 'end_date', 'period',
            'venue', 'category', 'artist', 'price', 'website', 'image_url',
            'api_source', 'culture_code', 'collected_at', 'is_active', 'created_at', 'updated_at'
        }
        
        # 모델에 없는 필드 제거
        normalized = {k: v for k, v in normalized.items() if k in model_fields}
        
        # culture_code 처리 - 없는 경우 대체 코드 생성
        if not normalized.get('culture_code'):
            # 제목과 API 소스로 고유 코드 생성
            title = normalized.get('title', 'unknown')
            api_source = normalized.get('api_source', 'unknown')
            venue = normalized.get('venue', '')
            
            # 해시를 사용하여 고유 코드 생성
            import hashlib
            unique_string = f"{api_source}:{title}:{venue}"
            normalized['culture_code'] = hashlib.md5(unique_string.encode()).hexdigest()[:16]
            logger.info(f"culture_code 자동 생성: {normalized['culture_code']} (from: {unique_string})")
        
        logger.debug(f"정규화된 데이터: title='{normalized.get('title')}', api_source='{normalized.get('api_source')}', culture_code='{normalized.get('culture_code')}'")
        
        return normalized
    

    

    
    async def _update_collection_stats(self, results: Dict) -> None:
        """수집 통계 업데이트"""
        try:
            current_time = datetime.now()
            collection_stats = results.get('collection_stats', {})
            
            logger.info(f"수집 통계 업데이트 시작: {len(collection_stats)}개 API")
            logger.info(f"전체 results 키들: {list(results.keys())}")
            logger.info(f"collection_stats 내용: {collection_stats}")
            
            for api_key, stats in collection_stats.items():
                try:
                    logger.info(f"처리 중인 API: {api_key}, 통계: {stats}")
                    
                    # API 소스 찾기 (존재하지 않으면 생성)
                    api_source = self.db.query(ApiSource).filter(
                        ApiSource.api_key == api_key
                    ).first()
                    
                    # API 소스가 없으면 자동 생성
                    if not api_source:
                        logger.info(f"API 소스가 없어서 자동 생성: {api_key}")
                        
                        # 기본 이름 매핑
                        name_mapping = {
                            'history_museum': '대한민국역사박물관 특별전시',
                            'arts_center': '예술의전당 전시정보',
                            'hangeul_museum': '국립한글박물관 전시정보',
                            'kocaca': '한국문화예술회관연합회 공연전시정보',
                            'kcdf': '한국공예디자인문화진흥원 전시도록',
                            'arko': '한국문화예술위원회 아르코미술관전시',
                            'jeonju_culture': '전주시 공연전시정보',
                            'sema': '서울시립미술관 전시정보',
                            'mapo_art': '마포문화재단 마포아트센터공연전시',
                            'mmca': '국립현대미술관 전시정보',
                            'integrated_exhibition': '한국문화정보원 외 전시정보(통합)',
                            'barrier_free': '한국문화정보원 전국 문화예술관광지 배리어프리 정보',
                            'museum_catalog': '국립중앙박물관 외 전시도록',
                            'jeju_culture': '제주문화예술진흥원 공연/전시 정보',
                            'daegu_culture': '대구광역시 공연·전시 정보',
                            'sema_archive': '서울시립미술관 아카이브'
                        }
                        
                        api_source = ApiSource(
                            api_key=api_key,
                            name=name_mapping.get(api_key, f'{api_key} API'),
                            base_url=f'auto-generated-{api_key}',
                            is_active=True,
                            total_collected=0
                        )
                        self.db.add(api_source)
                        self.db.flush()  # ID 생성을 위해 flush
                    
                    if api_source:
                        # 새로 수집된 개수 계산 (normalized_count 사용)
                        new_collected = stats.get('normalized_count', 0)
                        old_total = api_source.total_collected or 0
                        
                        # 총 수집 개수 업데이트
                        api_source.total_collected = old_total + new_collected
                        
                        # 마지막 수집 시간 업데이트
                        api_source.last_collection_at = current_time
                        
                        logger.info(f"{api_key}: 새로 수집 {new_collected}개 (normalized_count: {stats.get('normalized_count', 0)})")
                        logger.info(f"{api_key}: 기존 총합 {old_total}개 -> 새 총합 {api_source.total_collected}개")
                    # 이제 API 소스가 없는 경우는 위에서 자동 생성되므로 else는 불필요
                        
                except Exception as e:
                    logger.error(f"API 소스 {api_key} 통계 업데이트 실패: {str(e)}")
            
            # 변경사항 저장
            self.db.commit()
            logger.info("API 소스 통계 업데이트 완료")
            
        except Exception as e:
            logger.error(f"통계 업데이트 실패: {str(e)}")
            self.db.rollback()

 