"""
전시 데이터 수집 서비스
오픈 API를 통한 전시 정보 수집 및 DB 저장
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.domains.exhibition.models import Institution, Exhibition, DataSource
from app.core.config import settings
import json

logger = logging.getLogger(__name__)


class ExhibitionDataCollector:
    """전시 데이터 수집기"""
    
    def __init__(self, db: Session):
        self.db = db
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # 16개 API 설정 (업데이트된 버전)
        self.api_configs = {
            # 1. 문화공공데이터 광장 API (13개) - 각기 다른 API 키 사용
            "예술의전당": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "67a7bb34-331e-4136-a32d-61d663c1f902",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "대한민국역사박물관": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "2be9e796-ad86-4052-a35a-cbbfc690dd98",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "국립한글박물관": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "61bd783c-310d-446f-b954-474c7e5e5786",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "한국문화예술회관연합회": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "e0511ad1-e637-44dc-a2ad-608a0562417a",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "한국공예디자인문화진흥원": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "e77c4454-1197-4856-8003-d9a4af692cf1",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "한국문화예술위원회": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "52dd795c-83cb-46fc-bbf8-d09e078c7a55",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "전주시": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "9fe0e24d-ba40-470c-bd06-79147e932871",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "서울시립미술관": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "feb3f330-c7e3-41e6-ac1f-2aa79ca17078",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "마포문화재단": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "bf972437-adb8-432b-90f9-4aa739fe61f8",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "국립현대미술관": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "1851aea9-303e-4df4-ab29-903227afd400",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "한국문화정보원_전시통합": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "7daab567-98f0-463a-83f7-2daf3708699b",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "국립중앙박물관_전시도록": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "82050181-5c55-4adb-9232-310ba3b625c7",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            "한국문화정보원_배리어프리": {
                "url": "http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area",
                "serviceKey": "1c0b4f33-9d42-43f2-afea-ce63933132b0",
                "params": {"numOfRows": 100, "pageNo": 1}
            },
            
            # 2. 키값 불필요 API (2개)
            "대구광역시": {
                "url": "https://dgfca.or.kr/api/daegu/cultural-events",
                "serviceKey": None,
                "params": {"format": "json"}
            },
            "제주문화예술진흥원": {
                "url": "http://www.jeju.go.kr/rest/JejuExhibitionService/getJejucultureExhibitionList",
                "serviceKey": None,
                "params": {"page": 1, "pageSize": 100}
            },
            
            # 3. 서울시 개별 API (1개)
            "서울시립미술관_아카이브": {
                "url": "https://sema.seoul.go.kr/semaaa/front/openapi.do",
                "serviceKey": "76f1a6fddd3d4a2d8c6b92f14d414fbb",
                "params": {"ApiKey": "76f1a6fddd3d4a2d8c6b92f14d414fbb", "display": 100, "page": 1}
            }
        }

    async def collect_all_exhibitions(self) -> Dict[str, Any]:
        """모든 API에서 전시 정보 수집"""
        results = {
            "total_processed": 0,
            "total_created": 0,
            "total_updated": 0,
            "total_failed": 0,
            "details": {}
        }
        
        for institution_name, config in self.api_configs.items():
            logger.info(f"수집 시작: {institution_name}")
            try:
                result = await self._collect_from_api(institution_name, config)
                results["details"][institution_name] = result
                results["total_processed"] += result.get("processed", 0)
                results["total_created"] += result.get("created", 0)
                results["total_updated"] += result.get("updated", 0)
                results["total_failed"] += result.get("failed", 0)
                
            except Exception as e:
                logger.error(f"{institution_name} 수집 실패: {str(e)}")
                results["details"][institution_name] = {
                    "error": str(e),
                    "processed": 0,
                    "created": 0,
                    "updated": 0,
                    "failed": 1
                }
                results["total_failed"] += 1
                
        await self.client.aclose()
        return results

    async def _collect_from_api(self, institution_name: str, config: Dict) -> Dict[str, Any]:
        """개별 API에서 데이터 수집"""
        result = {"processed": 0, "created": 0, "updated": 0, "failed": 0}
        
        # 기관 정보 확인/생성
        institution = await self._get_or_create_institution(institution_name)
        
        try:
            # API 호출
            exhibitions_data = await self._fetch_api_data(config)
            
            for exhibition_data in exhibitions_data:
                try:
                    # 전시 정보 처리
                    processed = await self._process_exhibition(institution, exhibition_data)
                    if processed == "created":
                        result["created"] += 1
                    elif processed == "updated":
                        result["updated"] += 1
                    result["processed"] += 1
                    
                except Exception as e:
                    logger.error(f"전시 처리 실패: {str(e)}")
                    result["failed"] += 1
                    
        except Exception as e:
            logger.error(f"API 호출 실패 ({institution_name}): {str(e)}")
            raise
            
        return result

    async def _fetch_api_data(self, config: Dict) -> List[Dict]:
        """API에서 데이터 가져오기"""
        url = config["url"]
        params = config["params"].copy()
        
        # 서비스키 처리 (None인 경우 키값 불필요)
        if config["serviceKey"] is not None:
            if "{serviceKey}" in url:
                url = url.format(serviceKey=config["serviceKey"])
            else:
                params["serviceKey"] = config["serviceKey"]
        
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        
        # 응답 타입에 따른 처리
        try:
            if response.headers.get("content-type", "").startswith("application/json"):
                data = response.json()
            elif "sema.seoul.go.kr" in url:
                # 서울시립미술관 특별 처리 (HTML에 JSON 포함)
                data = self._parse_sema_html_response(response.text)
                if not data:
                    return []
            else:
                # XML 응답 처리
                data = response.text
                # 여기서 XML 파싱 로직이 필요할 수 있음 (lxml 등 사용)
                # 현재는 JSON만 처리
                return []
        except Exception as e:
            logger.error(f"응답 파싱 실패: {str(e)}")
            return []
        
        # API 응답 구조에 따라 전시 데이터 추출
        exhibitions = []
        if isinstance(data, dict):
            if "response" in data and "body" in data["response"]:
                # 문화공공데이터 광장 API 구조
                items = data["response"]["body"].get("items", {}).get("item", [])
                if isinstance(items, dict):
                    items = [items]
                exhibitions = items
            elif "SebmExhibitionInfo" in data:
                # 서울 공공데이터 API 구조
                exhibitions = data["SebmExhibitionInfo"]["row"]
            elif "events" in data:
                # 대구광역시 API 구조
                exhibitions = data["events"]
            elif "exhibitions" in data:
                # 제주문화예술진흥원 API 구조
                exhibitions = data["exhibitions"]
            elif "rows" in data:
                # 서울시립미술관 아카이브 API 구조
                exhibitions = data["rows"]
            elif isinstance(data, list):
                # 직접 배열 형태
                exhibitions = data
        elif isinstance(data, list):
            exhibitions = data
        
        return exhibitions

    def _parse_sema_html_response(self, html_text: str) -> Dict:
        """서울시립미술관 API의 HTML 응답에서 JSON 데이터 추출"""
        try:
            import re
            import json
            
            # HTML에서 result={"...} 형태의 데이터 추출
            pattern = r'result=(\{.*?\})\s*(?:\}|$)'
            match = re.search(pattern, html_text, re.DOTALL)
            
            if match:
                json_str = match.group(1)
                
                # 균형 잡힌 중괄호로 완전한 JSON 추출
                json_str = self._extract_balanced_json(json_str)
                if json_str:
                    data = json.loads(json_str)
                    return data
            
            # 실패 응답 처리
            if 'status=fail' in html_text:
                return {"total_count": 0, "rows": [], "status": "fail"}
                
            return None
            
        except Exception as e:
            logger.error(f"서울시립미술관 HTML 응답 파싱 실패: {str(e)}")
            return None

    def _extract_balanced_json(self, text: str) -> str:
        """균형 잡힌 JSON 문자열 추출"""
        if not text.startswith('{'):
            return None
            
        brace_count = 0
        in_string = False
        escape_next = False
        
        for i, char in enumerate(text):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        return text[:i+1]
        
        return text  # 완전하지 않으면 전체 반환

    async def _get_or_create_institution(self, name: str) -> Institution:
        """기관 정보 조회 또는 생성"""
        # 기존 기관 조회
        stmt = select(Institution).where(Institution.name == name)
        result = self.db.execute(stmt)
        institution = result.scalar_one_or_none()
        
        if not institution:
            # 새 기관 생성
            institution = Institution(
                name=name,
                institution_type=self._determine_institution_type(name)
                # is_active=True  # DB에 컬럼이 없음
            )
            self.db.add(institution)
            self.db.commit()
            self.db.refresh(institution)
            logger.info(f"새 기관 생성: {name}")
        
        return institution

    def _determine_institution_type(self, name: str) -> str:
        """기관명으로 타입 결정"""
        if "박물관" in name:
            return "museum"
        elif "미술관" in name:
            return "gallery"
        elif "예술" in name or "문화" in name:
            return "art_center"
        else:
            return "museum"

    async def _process_exhibition(self, institution: Institution, data: Dict) -> str:
        """전시 정보 처리 (중복 방지 포함)"""
        # 데이터 정규화
        normalized_data = self._normalize_exhibition_data(data)
        
        # source_id로 기존 전시 조회 (중복 방지)
        source_id = normalized_data.get("source_id")
        source = normalized_data.get("source", "open_api")
        
        if source_id:
            stmt = select(Exhibition).where(
                and_(
                    Exhibition.institution_id == institution.institution_id,
                    Exhibition.source_id == source_id,
                    Exhibition.source == source
                )
            )
            result = self.db.execute(stmt)
            existing_exhibition = result.scalar_one_or_none()
        else:
            # source_id가 없으면 제목과 기관으로 중복 체크
            title = normalized_data.get("title")
            if title:
                stmt = select(Exhibition).where(
                    and_(
                        Exhibition.institution_id == institution.institution_id,
                        Exhibition.title == title
                    )
                )
                result = self.db.execute(stmt)
                existing_exhibition = result.scalar_one_or_none()
            else:
                existing_exhibition = None
        
        if existing_exhibition:
            # 기존 전시가 있으면 업데이트
            for key, value in normalized_data.items():
                if hasattr(existing_exhibition, key) and value is not None:
                    setattr(existing_exhibition, key, value)
            self.db.commit()
            return "updated"
        else:
            # 새 전시 생성
            exhibition = Exhibition(
                institution_id=institution.institution_id,
                **normalized_data
            )
            self.db.add(exhibition)
            self.db.commit()
            return "created"

    def _normalize_exhibition_data(self, data: Dict) -> Dict[str, Any]:
        """API 응답 데이터를 DB 스키마에 맞게 정규화"""
        normalized = {}
        
        # 서울시립미술관 데이터 전처리 (fields 안의 데이터를 최상위로)
        if 'fields' in data:
            # 서울시립미술관 구조: {"fields": {...}, "location": {...}}
            fields_data = data['fields']
            # location 정보도 추가
            if 'location' in data and 'rowid' in data['location']:
                fields_data['rowid'] = data['location']['rowid']
            data = fields_data
        
        # 공통 필드 매핑 (실제 모델 필드명에 맞춤)
        field_mapping = {
            # 문화포털 API 필드
            "title": ["title", "prfnm", "fcltynm", "I_TITLE"],  # 서울시립미술관: I_TITLE
            "description": ["summary", "prfcast", "prfruntime", "I_SCOPE"],  # 서울시립미술관: I_SCOPE
            "start_date": ["startDate", "prfpdfrom", "I_DT"],  # 서울시립미술관: I_DT
            "end_date": ["endDate", "prfpdto"],
            "venue": ["place", "fcltynm"],
            "image_url": ["imageURL", "poster", "IMG_URL"],  # 서울시립미술관: IMG_URL
            "website": ["homepage", "relates"],
            "contact": ["phone", "I_DONOR"],  # 서울시립미술관: I_DONOR (기증자)
            "source_id": ["contentid", "mt20id", "seq", "I_ID", "I_REGNO", "rowid"],  # 서울시립미술관: I_ID, I_REGNO, rowid
            "category": ["CP_CLASS_NM", "I_TYPE_NM"],  # 서울시립미술관: I_TYPE_NM
            "organizer": ["I_CREATOR", "I_DONOR"]  # 서울시립미술관: I_CREATOR, I_DONOR
        }
        
        for target_field, source_fields in field_mapping.items():
            for source_field in source_fields:
                if source_field in data and data[source_field]:
                    value = data[source_field]
                    
                    # 날짜 필드 처리
                    if target_field in ["start_date", "end_date"] and isinstance(value, str):
                        try:
                            # YYYY.MM.DD 또는 YYYY-MM-DD 형식 변환
                            value = value.replace(".", "-")
                            if len(value) == 10:
                                normalized[target_field] = datetime.strptime(value, "%Y-%m-%d").date()
                        except ValueError:
                            continue
                    elif target_field == "image_url" and source_field == "IMG_URL":
                        # 서울시립미술관 이미지 URL 처리
                        if value and not value.startswith('http'):
                            value = f"https://sema.seoul.go.kr{value}"
                        normalized[target_field] = str(value) if value else None
                    else:
                        normalized[target_field] = str(value) if value else None
                    break
        
        # 필수 필드 검증 및 기본값 설정
        if not normalized.get("title"):
            # title이 없으면 venue나 다른 필드를 사용
            normalized["title"] = normalized.get("venue") or "제목 없음"
        
        # 추가 메타데이터 저장 (모델 필드명에 맞춤)
        # normalized["metadata"] = data  # 모델에 metadata 필드가 없음
        normalized["source"] = "open_api"  # data_source -> source
        
        # 전시 상태 결정
        if normalized.get("start_date") and normalized.get("end_date"):
            today = datetime.now().date()
            start_date = normalized["start_date"]
            end_date = normalized["end_date"]
            
            if start_date > today:
                normalized["status"] = "upcoming"
            elif start_date <= today <= end_date:
                normalized["status"] = "ongoing"
            else:
                normalized["status"] = "ended"
        
        return normalized


# 스케줄러 함수들
async def schedule_data_collection(db: Session):
    """정기 데이터 수집 실행"""
    collector = ExhibitionDataCollector(db)
    return await collector.collect_all_exhibitions()


def setup_data_sources(db: Session):
    """초기 데이터 소스 설정"""
    sources = [
        {
            "name": "국립현대미술관",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_148/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "서울시립미술관", 
            "type": "api",
            "api_endpoint": "http://openapi.seoul.go.kr:8088/{serviceKey}/json/SebmExhibitionInfo/",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "예술의전당",
            "type": "api", 
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_142/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "세종문화회관",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_145/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "국립중앙박물관",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_135/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        # 새로 추가된 API들
        {
            "name": "대한민국역사박물관",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_496/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "국립한글박물관",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_487/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "한국문화예술회관연합회",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_456/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "한국공예디자인문화진흥원",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_175/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "한국문화예술위원회",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_211/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "전주시",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_233/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "마포문화재단",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_245/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
        },
        {
            "name": "서울시립미술관_문화포털",
            "type": "api",
            "api_endpoint": "http://api.kcisa.kr/openapi/API_CCA_272/request",
            "authentication_method": "api_key",
            "sync_interval_hours": 24
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
    logger.info("데이터 소스 설정 완료") 