#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
16개 문화기관 API 통합 허브 시스템
전국 주요 문화예술기관 데이터를 중앙 집중화하는 문화 허브
"""

import requests
import xmltodict
import json
import re
from datetime import datetime, timedelta
import os
import logging
from typing import Dict, List, Optional, Any, Tuple
import time
import concurrent.futures
import threading
from urllib.parse import quote
import random
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import html
from html import unescape

# ======================================
# 페이지 수 설정 (전역 변수)
# ======================================
# API별 최대 수집 페이지 수 설정
# - 테스트 시: 1~10 페이지
# - 전체 수집 시: 500 페이지 이상
DEFAULT_MAX_PAGES = 1  # 기본 최대 페이지 수
SEMA_ARCHIVE_MAX_PAGES = 1  # 서울시립미술관 아카이브 전용 (데이터가 많음)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cultural_hub_api.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class CulturalHubAPISystem:
    """16개 문화기관 API 통합 허브 시스템"""
    
    def __init__(self):
        """문화 허브 시스템 초기화"""
        self.base_url = "https://api.kcisa.kr/openapi"
        self.direct_base_url = "https://api.kcisa.kr"  # 국립중앙박물관용 직접 URL
        self.request_lock = threading.Lock()
        
                    # 문화 허브 안전 연결 설정
        self.safe_config = {
            'base_delay': 1.5,          # 기본 대기 시간 (1.5초)
            'max_delay': 8.0,           # 최대 대기 시간 (8초)
            'retry_count': 3,           # 재시도 횟수 (줄임)
            'timeout': 300,             # 타임아웃 (5분)
            'max_workers': 2,           # 최대 동시 작업자 (2개로 제한)
            'exponential_backoff': True, # 지수 백오프 사용
            'sequential_fallback': True  # 순차 처리 폴백
        }
        
        # 16개 문화기관 API 완전 검증된 허브 설정
        self.cultural_api_config = {
            'arts_center': {
                'endpoint': 'API_CCA_149/request',
                'service_key': '67a7bb34-331e-4136-a32d-61d663c1f902',
                'name': '예술의전당 전시정보',
                'category': '전시',
                'priority': 1,  # 우선순위 (낮을수록 먼저 처리)
                'institution_type': '공연장',
                'location': '서울',
                'column_mapping': {
                    'TITLE': '제목',
                    'CNTC_INSTT_NM': '연계기관명',
                    'COLLECTED_DATE': '수집일',
                    'ISSUED_DATE': '자료생성일자',
                    'DESCRIPTION': '소개설명',
                    'IMAGE_OBJECT': '이미지주소',
                    'LOCAL_ID': '전시ID',
                    'URL': '홈페이지주소',
                    'EVENT_SITE': '장소',
                    'GENRE': '장르',
                    'PERIOD': '기간',
                    'EVENT_PERIOD': '시간',
                    'AUTHOR': '작가',
                    'CONTACT_POINT': '문의',
                    'CHARGE': '관람료할인정보'
                }
            },
            
            'history_museum': {
                'endpoint': 'service/rest/meta2020/getMCHBspecial',
                'service_key': '2be9e796-ad86-4052-a35a-cbbfc690dd98',
                'name': '대한민국역사박물관 특별전시',
                'category': '특별전시',
                'priority': 2,
                'institution_type': '국립박물관',
                'location': '서울',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'collectionDb': '장르',
                    'eventPeriod': '기간',
                    'venue': '장소',
                    'publisher': '발행처',
                }
            },
            
            'hangeul_museum': {
                'endpoint': 'service/rest/meta2020/getNHMBex',
                'service_key': '61bd783c-310d-446f-b954-474c7e5e5786',
                'name': '국립한글박물관 전시정보',
                'category': '전시',
                'priority': 3,
                'institution_type': '국립박물관',
                'location': '서울',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'url': '홈페이지주소',
                    'collectionDb': '장르',
                    'publisher': '발행처',
                    'subDescription': '부가설명',
                }
            },
            
            'kocaca': {
                'endpoint': 'service/rest/meta2020/getKOCAperf',
                'service_key': 'e0511ad1-e637-44dc-a2ad-608a0562417a',
                'name': '한국문화예술회관연합회 공연전시정보',
                'category': '공연전시',
                'priority': 4,
                'institution_type': '문화예술회관',
                'location': '전국',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'referenceIdentifier': '이미지주소',
                    'url': '홈페이지주소',
                    'venue': '장소',
                    'collectionDb': '장르',
                    'eventPeriod': '기간',
                    'charge': '관람료할인정보',
                    'publisher': '발행처',
                    'sourceTitle': '원본제목',
                    'rights': '문의',
                }
            },
            
            'kcdf': {
                'endpoint': 'service/rest/meta8/getKCDA1503',
                'service_key': 'e77c4454-1197-4856-8003-d9a4af692cf1',
                'name': '한국공예디자인문화진흥원 전시도록',
                'category': '전시도록',
                'priority': 5,
                'institution_type': '진흥원',
                'location': '서울',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'referenceIdentifier': '이미지주소',
                    'url': '홈페이지주소',
                    'collectionDb': '장르',
                    'alternativeTitle': '부제목',
                    'extent': '크기정보',
                    'language': '언어',
                    'contributor': '기여자',
                    'copyrightOthers': '저작권정보',
                }
            },
            
            'arko': {
                'endpoint': 'service/rest/meta4/getARKA1202',
                'service_key': '52dd795c-83cb-46fc-bbf8-d09e078c7a55',
                'name': '한국문화예술위원회 아르코미술관전시',
                'category': '미술관전시',
                'priority': 6,
                'institution_type': '미술관',
                'location': '서울',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'collectionDb': '장르',
                    'subjectKeyword': '키워드',
                    'alternativeTitle': '부제목',
                    'extent': '크기정보',
                    'language': '언어',
                    'contributor': '기여자',
                    'copyrightOthers': '저작권정보',
                    'sourceTitle': '원본제목',
                }
            },
            
            'jeonju_culture': {
                'endpoint': 'service/rest/other/getJEON5201',
                'service_key': '9fe0e24d-ba40-470c-bd06-79147e932871',
                'name': '전주시 공연전시정보',
                'category': '지역공연전시',
                'priority': 7,
                'institution_type': '지방자치단체',
                'location': '전주',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'spatialCoverage': '장소',
                    'collectionDb': '장르',
                    'temporalCoverage': '기간',
                    'charge': '관람료할인정보',
                    'grade': '등급정보',
                    'alternativeTitle': '부제목',
                    'extent': '크기정보',
                    'language': '언어',
                    'contributor': '기여자',
                    'copyrightOthers': '저작권정보',
                    'rights': '문의',
                }
            },
            
            'sema': {
                'endpoint': 'service/rest/other/getSEMN5601',
                'service_key': 'feb3f330-c7e3-41e6-ac1f-2aa79ca17078',
                'name': '서울시립미술관 전시정보',
                'category': '시립미술관전시',
                'priority': 8,
                'institution_type': '시립미술관',
                'location': '서울',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'venue': '장소',
                    'collectionDb': '장르',
                    'eventPeriod': '기간',
                    'charge': '관람료할인정보',
                    'grade': '등급정보',
                    'referenceIdentifier': '이미지주소',
                    'alternativeTitle': '부제목',
                    'extent': '크기정보',
                    'language': '언어',
                    'contributor': '기여자',
                    'copyrightOthers': '저작권정보',
                    'sourceTitle': '원본제목',
                    'rights': '문의',
                }
            },
            
            'mapo_art': {
                'endpoint': 'service/rest/other/getMAPN0701',
                'service_key': 'bf972437-adb8-432b-90f9-4aa739fe61f8',
                'name': '마포문화재단 마포아트센터공연전시',
                'category': '지역아트센터',
                'priority': 9,
                'institution_type': '문화재단',
                'location': '서울 마포',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'regDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'venue': '장소',
                    'collectionDb': '장르',
                    'eventPeriod': '기간',
                    'charge': '관람료할인정보',
                    'grade': '등급정보',
                    'rights': '문의',
                    'alternativeTitle': '부제목',
                    'extent': '크기정보',
                    'language': '언어',
                    'contributor': '기여자',
                    'copyrightOthers': '저작권정보',
                    'sourceTitle': '원본제목',
                }
            },
            
            'mmca': {
                'endpoint': 'service/rest/moca/docMeta',
                'service_key': '1851aea9-303e-4df4-ab29-903227afd400',
                'name': '국립현대미술관 전시정보',
                'category': '국립미술관전시',
                'priority': 10,
                'institution_type': '국립미술관',
                'location': '서울/과천/덕수궁/청주',
                'column_mapping': {
                    'title': '제목',
                    'creator': '연계기관명',
                    'subDescription': '소개설명',
                    'venue': '장소',
                    'collectionDb': '장르',
                    'eventPeriod': '기간',
                    'person': '작가',
                    'charge': '관람료할인정보',
                    'rights': '문의',
                    'subjectCategory': '카테고리',
                    'publisher': '발행처',
                }
            },
            
            'integrated_exhibition': {
                'endpoint': 'API_CCA_145/request',
                'service_key': '7daab567-98f0-463a-83f7-2daf3708699b',
                'name': '한국문화정보원 외 전시정보(통합)',
                'category': '통합전시정보',
                'priority': 11,
                'institution_type': '통합정보원',
                'location': '전국',
                'column_mapping': {
                    'TITLE': '제목',
                    'CNTC_INSTT_NM': '연계기관명',
                    'COLLECTED_DATE': '수집일',
                    'ISSUED_DATE': '자료생성일자',
                    'DESCRIPTION': '소개설명',
                    'IMAGE_OBJECT': '이미지주소',
                    'LOCAL_ID': '전시ID',
                    'URL': '홈페이지주소',
                    'EVENT_SITE': '장소',
                    'GENRE': '장르',
                    'PERIOD': '기간',
                    'EVENT_PERIOD': '시간',
                    'AUTHOR': '작가',
                    'CONTACT_POINT': '문의',
                    'CHARGE': '관람료할인정보',
                    'CONTRIBUTOR': '기여기관',
                    'AUDIENCE': '관람대상',
                    'SUB_DESCRIPTION': '부가설명',
                    'VIEW_COUNT': '조회수',
                }
            },
            
            'barrier_free': {
                'endpoint': 'API_TOU_049/request',
                'service_key': '1c0b4f33-9d42-43f2-afea-ce63933132b0',
                'name': '한국문화정보원 전국 문화예술관광지 배리어프리 정보',
                'category': '배리어프리정보',
                'priority': 12,
                'institution_type': '정보원',
                'location': '전국',
                'column_mapping': {
                    'title': '제목',
                    'category1': '카테고리1',
                    'issuedDate': '수집일',
                    'description': '소개설명',
                    'url': '홈페이지주소',
                    'address': '장소',
                    'category2': '카테고리2',
                    'subDescription': '시설정보',
                    'coordinates': '좌표정보',
                    'tel': '문의전화',
                    'category3': '세부카테고리'
                }
            },
            
            # 특별 처리가 필요한 문화기관
            'museum_catalog': {
                'endpoint': 'API_CNV_049/request',
                'service_key': '82050181-5c55-4adb-9232-310ba3b625c7',
                'name': '국립중앙박물관 외 전시도록',
                'category': '박물관전시도록',
                'priority': 13,
                'institution_type': '국립박물관',
                'location': '서울',
                'sensitive': True,  # 민감한 API 표시
                'column_mapping': {
                    'title': '제목',
                    'alternativeTitle': '부제목',
                    'createdDate': '수집일',
                    'description': '소개설명',
                    'imageObject': '이미지주소',
                    'url': '홈페이지주소',
                    'subjectKeyword': '키워드',
                    'period': '기간',
                    'subDescription': '부가설명',
                    'sizing': '크기정보',
                    'charge': '유료무료정보',
                    'localId': '원천기관자료식별자',
                    'viewCount': '조회수'
                }
            },
            
            # 지역 문화기관: 제주문화예술진흥원
            'jeju_culture': {
                'endpoint': 'rest/JejuExhibitionService/getJejucultureExhibitionList',
                'service_key': None,  # 키 불필요
                'name': '제주문화예술진흥원 공연/전시 정보',
                'category': '지역문화예술',
                'priority': 14,
                'institution_type': '지역진흥원',
                'location': '제주',
                'base_url': 'http://www.jeju.go.kr',  # 특별한 베이스 URL
                'response_format': 'xml',  # XML 응답
                'column_mapping': {
                    'title': '제목',
                    'owner': '연계기관명',
                    'start': '시작일',
                    'end': '종료일',
                    'hour': '시간',
                    'cover': '이미지주소',
                    'coverThumb': '썸네일이미지',
                    'locNames': '장소',
                    'categoryName': '장르',
                    'pay': '관람료정보',
                    'tel': '문의전화',
                    'stat': '상태정보',
                    'seq': '일련번호',
                    'divName': '상세장르',
                    'category': '카테고리코드',
                    'locs': '장소코드',
                }
            },
            
            # 지역 문화기관: 대구광역시
            'daegu_culture': {
                'endpoint': 'api/daegu/cultural-events',
                'service_key': None,  # 키 불필요
                'name': '대구광역시 공연·전시 정보',
                'category': '지역문화행사',
                'priority': 15,
                'institution_type': '광역시',
                'location': '대구',
                'base_url': 'https://dgfca.or.kr',  # 특별한 베이스 URL
                'response_format': 'json',  # JSON 응답
                'column_mapping': {
                    'subject': '제목',
                    'event_gubun': '구분',
                    'start_date': '시작일',
                    'end_date': '종료일',
                    'place': '장소',
                    'event_area': '지역',
                    'host': '주최',
                    'contact': '문의',
                    'pay_gubun': '유료무료',
                    'pay': '관람료할인정보',
                    'homepage': '홈페이지주소',
                    'content': '소개설명',
                    'event_seq': '전시ID'
                }
            },
            
            # 서울시립미술관 아카이브
            'sema_archive': {
                'endpoint': 'semaaa/front/openapi.do',
                'service_key': '76f1a6fddd3d4a2d8c6b92f14d414fbb',
                'name': '서울시립미술관 아카이브',
                'category': '미술관아카이브',
                'priority': 16,
                'institution_type': '시립미술관아카이브',
                'location': '서울',
                'base_url': 'https://sema.seoul.go.kr',  # 특별한 베이스 URL
                'response_format': 'html',  # HTML 응답
                'column_mapping': {
                    'I_TITLE': '제목',
                    'I_SCOPE': '소개설명',
                    'CP_CLASS_NM': '장르',
                    'I_CREATOR': '작가',
                    'I_DT': '생산일자',
                    'I_DONOR': '수집처',
                    'I_TYPE': '자료유형',
                    'I_TYPE_NM': '자료유형명',
                    'I_TITLE_STR': '부제목',
                    'I_CLSSSUB_SUB': '분류',
                    'BK_VOL_NO': '권호',
                    'I_REGNO': '등록번호',
                    'IMG_URL': '이미지URL',
                    'REG_DT': '등록일자',
                    'I_ID': '아이디',
                    'CP_CLASS': '분류코드',
                    'I_DIGITAL_NM': '전자여부'
                }
            }
        }
        
        # 문화예술 표준 컬럼 정의
        self.cultural_standard_columns = [
            '제목', '연계기관명', '수집일', '자료생성일자', '소개설명', 
            '이미지주소', '홈페이지주소', '장소', '장르', '기간', '시간',
            '작가', '문의', '관람료할인정보', '전시ID', '부제목', '크기정보',
            '키워드', '시설정보', '접근성정보', '등급정보', '시간적범위',
            '공간정보', '좌표정보', '문의전화', '세부카테고리', '부가설명',
            '유료무료정보', '원천기관자료식별자', '조회수', '카테고리1', 
            '카테고리2'
        ]
        
        # 안전한 문화 허브 연결 세션 설정
        self.session = self.create_safe_cultural_session()
        
    def create_safe_cultural_session(self) -> requests.Session:
        """문화 허브 연결을 위한 안전한 HTTP 세션 생성"""
        session = requests.Session()
        
        # 재시도 전략 설정
        retry_strategy = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
            raise_on_status=False
        )
        
        # HTTP 어댑터 설정
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # 문화 허브 친화적 헤더 설정
        session.headers.update({
            'User-Agent': 'CulturalHub/1.0 (Cultural Art Data Hub; +http://cultural-hub.kr)',
            'Accept': 'application/xml, text/xml, application/json, */*',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        })
        
        return session
    
    def safe_delay(self, base_delay: float = None, attempt: int = 0, cancel_check=None) -> bool:
        """문화 허브 서버를 위한 안전한 지연 처리 (취소 확인 가능)"""
        if base_delay is None:
            base_delay = self.safe_config['base_delay']
        
        if self.safe_config['exponential_backoff'] and attempt > 0:
            delay = min(base_delay * (2 ** attempt), self.safe_config['max_delay'])
        else:
            delay = base_delay
        
        # 약간의 랜덤 지터 추가 (문화기관 서버 부하 분산)
        jitter = random.uniform(0.1, 0.3)
        total_delay = delay + jitter
        
        logging.debug(f"문화 허브 안전 지연: {total_delay:.2f}초 (시도: {attempt + 1})")
        
        # 0.1초 단위로 나누어서 취소 확인
        sleep_intervals = int(total_delay / 0.1)
        remaining_time = total_delay % 0.1
        
        for _ in range(sleep_intervals):
            time.sleep(0.1)
            if cancel_check and cancel_check():
                logging.info("지연 중 취소 요청 감지")
                return False
        
        if remaining_time > 0:
            time.sleep(remaining_time)
            if cancel_check and cancel_check():
                logging.info("지연 중 취소 요청 감지")
                return False
        
        return True
    
    def safe_cultural_api_call(self, api_key: str, config: Dict, params: Dict, attempt: int = 0, cancel_check=None) -> Tuple[bool, Any, str]:
        """완전 안전한 문화 허브 API 호출"""
        # 특별한 URL 구성
        if api_key == 'museum_catalog':
            url = f"{self.direct_base_url}/{config['endpoint']}"
        elif api_key == 'jeju_culture':
            # 제주문화예술진흥원은 특별한 베이스 URL 사용
            url = f"{config['base_url']}/{config['endpoint']}"
        elif api_key == 'daegu_culture':
            # 대구광역시는 특별한 베이스 URL 사용 (JSON 응답)
            url = f"{config['base_url']}/{config['endpoint']}"
        elif api_key == 'sema_archive':
            # 서울시립미술관 아카이브는 특별한 베이스 URL 사용
            url = f"{config['base_url']}/{config['endpoint']}"
        else:
            url = f"{self.base_url}/{config['endpoint']}"
        
        # 민감한 문화기관 API는 더 긴 대기 시간
        base_delay = 2.0 if config.get('sensitive', False) else self.safe_config['base_delay']
        
        with self.request_lock:
            # 문화 허브 서버를 위한 안전한 지연 (취소 확인 포함)
            if not self.safe_delay(base_delay, attempt, cancel_check):
                return False, None, "사용자에 의해 취소됨"
        
        try:
            logging.debug(f"문화 허브 API 호출 시작: {config['name']} (시도: {attempt + 1})")
            
            # 취소 확인 가능한 적절한 타임아웃으로 요청
            short_timeout = 30  # 30초로 설정
            max_retries = 2     # 최대 2회 재시도
            
            for retry in range(max_retries):
                # 각 재시도 전에 취소 확인
                if cancel_check and cancel_check():
                    return False, None, "사용자에 의해 취소됨"
                
                try:
                    response = self.session.get(
                        url, 
                        params=params, 
                        timeout=short_timeout
                    )
                    break  # 성공하면 루프 종료
                    
                except requests.exceptions.Timeout:
                    if retry < max_retries - 1:
                        logging.debug(f"{config['name']} 타임아웃, 재시도 {retry + 1}/{max_retries}")
                        # 짧은 대기 후 재시도 (취소 확인 포함)
                        for _ in range(10):  # 1초를 0.1초 단위로 분할
                            time.sleep(0.1)
                            if cancel_check and cancel_check():
                                return False, None, "사용자에 의해 취소됨"
                        continue
                    else:
                        return False, None, f"문화기관 서버 타임아웃 ({short_timeout * max_retries}초)"
            
            # 상태 코드 확인
            if response.status_code == 429:
                return False, None, f"Rate limit 초과 (429)"
            elif response.status_code == 404:
                return False, None, f"엔드포인트를 찾을 수 없음 (404)"
            elif response.status_code >= 500:
                return False, None, f"문화기관 서버 오류 ({response.status_code})"
            
            response.raise_for_status()
            
            # 서울시립미술관 아카이브는 HTML 응답
            if api_key == 'sema_archive':
                try:
                    # HTML에서 {result=...} 패턴 찾기
                    pattern = r'\{result=(\{.*?\}), totCnt=(\d+), message=(.*?), list=(.*?), status=(\w+)\}'
                    match = re.search(pattern, response.text, re.DOTALL)
                    
                    if match:
                        result_json = match.group(1)
                        total_count = int(match.group(2))
                        message = match.group(3)
                        list_data = match.group(4)
                        status = match.group(5)
                        
                        # result JSON 파싱
                        try:
                            result_data = json.loads(result_json)
                            
                            # 표준 API 응답 구조로 변환
                            formatted_response = {
                                'header': {
                                    'resultCode': '00',
                                    'resultMsg': 'SUCCESS'
                                },
                                'body': {
                                    'totalCount': str(total_count),
                                    'items': {
                                        'item': result_data.get('rows', []) if isinstance(result_data, dict) else []
                            }
                                }
                            }
                            
                            return True, {'response': formatted_response}, f"성공 (총 {total_count}개)"
                            
                        except json.JSONDecodeError as e:
                            return False, None, f'JSON 파싱 실패: {str(e)}'
                    else:
                        return False, None, '패턴 매칭 실패'
                        
                except Exception as e:
                    return False, None, f'추출 실패: {str(e)}'
            
            # 대구광역시 API는 JSON 응답
            elif api_key == 'daegu_culture':
                try:
                    json_data = response.json()
                    
                    # 배열 형태의 응답을 표준 구조로 변환
                    if isinstance(json_data, list):
                        total_count = len(json_data)
                        message = f"성공 (JSON 배열, 총 데이터: {total_count}개)"
                        
                        # 표준 API 응답 구조로 변환
                        formatted_response = {
                            'header': {
                                'resultCode': '00',
                                'resultMsg': 'SUCCESS'
                            },
                            'body': {
                                'totalCount': str(total_count),
                                'items': {
                                    'item': json_data
                                }
                            }
                        }
                        
                        return True, {'response': formatted_response}, message
                    else:
                        return False, None, "대구 API 응답이 예상 형식이 아닙니다."
                        
                except json.JSONDecodeError:
                    return False, None, "대구 API JSON 파싱 오류"
            
            # XML 파싱 (기존 API들)
            xml_data = xmltodict.parse(response.content)
            
            # 제주문화예술진흥원 API는 특별한 응답 구조
            if api_key == 'jeju_culture':
                if 'jejunetApi' in xml_data:
                    jeju_data = xml_data['jejunetApi']
                    result_code = jeju_data.get('resultCode', 'UNKNOWN')
                    result_msg = jeju_data.get('resultMsg', 'Unknown')
                    
                    if result_code == '00':
                        items = jeju_data.get('items', {})
                        # items 안의 item들 추출
                        if isinstance(items, dict) and 'item' in items:
                            item_list = items['item']
                            if isinstance(item_list, dict):
                                item_list = [item_list]  # 단일 아이템을 리스트로 변환
                            total_count = len(item_list) if item_list else 0
                        else:
                            item_list = []
                            total_count = 0
                        
                        message = f"성공 (코드: {result_code}, 총 데이터: {total_count}개)"
                        
                        # 제주 API용 응답 구조로 변환
                        formatted_response = {
                            'header': {
                                'resultCode': result_code,
                                'resultMsg': result_msg
                            },
                            'body': {
                                'totalCount': str(total_count),
                                'items': {
                                    'item': item_list
                                }
                            }
                        }
                        
                        return True, {'response': formatted_response}, message
                    else:
                        message = f"제주 문화기관 API 응답 코드: {result_code} - {result_msg}"
                        return False, None, message
            
            # 기존 문화공공데이터 광장 API 처리
            if 'response' in xml_data:
                response_data = xml_data['response']
                
                if 'header' in response_data:
                    result_code = response_data['header'].get('resultCode', 'UNKNOWN')
                    result_msg = response_data['header'].get('resultMsg', 'Unknown')
                    
                    if result_code in ['00', '0000']:
                        body = response_data.get('body', {})
                        total_count = int(body.get('totalCount', 0))
                        message = f"성공 (코드: {result_code}, 총 데이터: {total_count}개)"
                        return True, response_data, message
                    else:
                        message = f"문화기관 API 응답 코드: {result_code} - {result_msg}"
                        return False, None, message
            
            return False, None, "문화기관 API 응답 구조가 예상과 다릅니다."
            
        except requests.exceptions.Timeout:
            return False, None, f"문화기관 서버 타임아웃 ({self.safe_config['timeout']}초)"
        except requests.exceptions.ConnectionError:
            return False, None, "문화기관 서버 연결 오류"
        except requests.exceptions.RequestException as e:
            return False, None, f"문화기관 API 요청 오류: {str(e)}"
        except Exception as e:
            return False, None, f"예기치 않은 오류: {str(e)}"
    
    def test_cultural_api_safely(self, api_key: str, config: Dict, cancel_check=None) -> Tuple[bool, int, str]:
        """안전한 문화 허브 API 테스트"""
        # 특별한 파라미터 구조가 필요한 API들
        if api_key == 'jeju_culture':
            params = {}  # 제주 API는 파라미터 없이 모든 데이터 반환
        elif api_key == 'daegu_culture':
            params = {}  # 대구 API는 파라미터 없이 모든 데이터 반환
        elif api_key == 'sema_archive':
            params = {'ApiKey': config['service_key'], 'display': '5'}  # 서울시립미술관 아카이브
        else:
            params = {
                'serviceKey': config['service_key'],
                'numOfRows': 5,
                'pageNo': 1
            }
        
        last_error = "알 수 없는 오류"
        
        for attempt in range(self.safe_config['retry_count']):
            # 취소 확인
            if cancel_check and cancel_check():
                return False, 0, "사용자에 의해 취소됨"
            
            success, data, message = self.safe_cultural_api_call(api_key, config, params, attempt, cancel_check)
            
            if success:
                # 성공한 경우 데이터 개수 추출
                if data and 'response' in data:
                    response_data = data['response']
                    if 'body' in response_data:
                        body = response_data['body']
                        total_count = int(body.get('totalCount', 0))
                        return True, total_count, message
                elif data and 'body' in data:
                    # 기존 일반 API 구조 지원
                    body = data['body']
                    total_count = int(body.get('totalCount', 0))
                    return True, total_count, message
                return True, 0, message
            
            # 취소 메시지 확인
            if "취소됨" in message:
                return False, 0, message
            
            last_error = message
            
            # 404나 권한 오류는 재시도하지 않음
            if "404" in message or "401" in message or "403" in message:
                break
            
            # 마지막 시도가 아니면 대기 (취소 확인 포함)
            if attempt < self.safe_config['retry_count'] - 1:
                wait_time = 2 ** attempt  # 지수 백오프
                logging.warning(f"{config['name']} 재시도 대기: {wait_time}초 (시도: {attempt + 1}/{self.safe_config['retry_count']})")
                
                # 인터럽트 가능한 sleep
                for _ in range(int(wait_time * 10)):  # 0.1초 단위
                    time.sleep(0.1)
                    if cancel_check and cancel_check():
                        return False, 0, "사용자에 의해 취소됨"
        
        return False, 0, f"최종 실패: {last_error}"
    
    def _extract_sema_data(self, html_response: str) -> Dict[str, Any]:
        """서울시립미술관 아카이브 HTML 응답에서 JSON 데이터 추출"""
        try:
            # HTML에서 {result=...} 패턴 찾기
            pattern = r'\{result=(\{.*?\}), totCnt=(\d+), message=(.*?), list=(.*?), status=(\w+)\}'
            match = re.search(pattern, html_response, re.DOTALL)
            
            if match:
                result_json = match.group(1)
                total_count = int(match.group(2))
                message = match.group(3)
                list_data = match.group(4)
                status = match.group(5)
                
                # result JSON 파싱
                try:
                    result_data = json.loads(result_json)
                    return {
                        'success': True,
                        'status': status,
                        'total_count': total_count,
                        'message': message,
                        'data': result_data,
                        'extracted_count': len(result_data.get('rows', [])) if isinstance(result_data, dict) else 0
                    }
                except json.JSONDecodeError as e:
                    return {
                        'success': False,
                        'error': f'JSON 파싱 실패: {str(e)}',
                        'raw_result': result_json[:500]
                    }
            else:
                return {
                    'success': False,
                    'error': '패턴 매칭 실패',
                    'raw_html': html_response[:500]
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'추출 실패: {str(e)}'
            }
    
    def collect_cultural_data_safely(self, api_key: str, config: Dict, max_pages: int = 10, cancel_check=None) -> List[Dict]:
        """안전한 문화 허브 데이터 수집"""
        all_data = []
        page = 1
        consecutive_failures = 0
        max_consecutive_failures = 3
        
        # 특별 처리가 필요한 API들 (페이징 없이 모든 데이터를 한 번에 반환)
        if api_key in ['jeju_culture', 'daegu_culture', 'sema_archive']:
            if api_key == 'sema_archive':
                # 서울시립미술관 아카이브는 페이징 지원 (최대 100개씩)
                total_collected = 0
                for page in range(1, max_pages + 1):  # 설정된 페이지 수만큼 수집
                    params = {
                        'ApiKey': config['service_key'], 
                        'display': '100',
                        'page': str(page)
                    }
                    success, data, message = self.safe_cultural_api_call(api_key, config, params)
                    
                    if success and data and 'response' in data:
                        response_data = data['response']
                        if 'body' in response_data:
                            body = response_data['body']
                            items = body.get('items', {})
                            if isinstance(items, dict) and 'item' in items:
                                page_items = items['item']
                                if isinstance(page_items, dict):
                                    page_items = [page_items]
                                elif isinstance(page_items, list):
                                    pass
                                else:
                                    break
                                
                                all_data.extend(page_items)
                                total_collected += len(page_items)
                                logging.info(f"{config['name']} - 페이지 {page}: {len(page_items)}개 아카이브 수집 (총 {total_collected}개)")
                                
                                # 첫 페이지의 처음 3개 데이터 샘플 로그 출력
                                if page == 1 and len(page_items) > 0:
                                    for i, item in enumerate(page_items[:3]):
                                        logging.info(f"  샘플 {i+1}: {item}")
                                
                                if len(page_items) < 100:
                                    break
                            else:
                                break
                    else:
                        logging.warning(f"{config['name']} - 페이지 {page} 실패: {message}")
                        break
                
                logging.info(f"{config['name']} - 총 {len(all_data)}개 아카이브 데이터 수집 완료")
            else:
                # 제주, 대구는 기존 로직
                params = {}
                success, data, message = self.safe_cultural_api_call(api_key, config, params)
            
            if success and data and 'response' in data:
                response_data = data['response']
                if 'body' in response_data:
                    body = response_data['body']
                    items = body.get('items', {})
                    if isinstance(items, dict) and 'item' in items:
                        page_items = items['item']
                        if isinstance(page_items, dict):
                            page_items = [page_items]
                        elif isinstance(page_items, list):
                            pass
                        else:
                            page_items = []
                        
                        all_data.extend(page_items)
                        if api_key == 'daegu_culture':
                            logging.info(f"{config['name']} - {len(page_items)}개 문화행사 수집 완료")
                        else:
                            logging.info(f"{config['name']} - {len(page_items)}개 항목 수집 완료")
            
            return all_data
        
        # 기존 문화공공데이터 광장 API 처리 (페이징)
        while page <= max_pages and consecutive_failures < max_consecutive_failures:
            # 취소 확인
            if cancel_check and cancel_check():
                logging.info(f"{config['name']} 페이징 중 취소 요청 감지")
                break
            
            params = {
                'serviceKey': config['service_key'],
                'numOfRows': 100,
                'pageNo': page
            }
            
            success, data, message = self.safe_cultural_api_call(api_key, config, params, 0, cancel_check)
            
            if not success:
                consecutive_failures += 1
                logging.warning(f"{config['name']} 페이지 {page} 실패: {message}")
                
                if consecutive_failures >= max_consecutive_failures:
                    logging.error(f"{config['name']} 연속 실패 한계 도달, 중단")
                    break
                
                # 실패 시 더 긴 대기 (취소 확인 포함)
                for _ in range(30):  # 3초를 0.1초 단위로 분할
                    time.sleep(0.1)
                    if cancel_check and cancel_check():
                        logging.info(f"{config['name']} 실패 대기 중 취소 요청 감지")
                        return all_data
                continue
            
            consecutive_failures = 0  # 성공 시 연속 실패 카운터 리셋
            
            if not data or 'body' not in data:
                break
            
            body = data['body']
            total_count = int(body.get('totalCount', 0))
            
            if total_count == 0:
                break
            
            items = body.get('items', {})
            if isinstance(items, dict) and 'item' in items:
                page_items = items['item']
                if isinstance(page_items, dict):
                    page_items = [page_items]
                elif isinstance(page_items, list):
                    pass
                else:
                    break
                
                all_data.extend(page_items)
                logging.info(f"{config['name']} - 페이지 {page}: {len(page_items)}개 항목 수집 (총 {len(all_data)}개)")
                
                # 첫 페이지의 처음 3개 데이터 샘플 로그 출력
                if page == 1 and len(page_items) > 0:
                    for i, item in enumerate(page_items[:3]):
                        logging.info(f"  샘플 {i+1}: {item}")
                
                if len(page_items) < 100:
                    break
            else:
                break
            
            page += 1
        
        logging.info(f"{config['name']} - 총 {len(all_data)}개 문화 데이터 수집 완료")
        return all_data
    
    def normalize_cultural_data(self, raw_data: List[Dict], source_api: str, config: Dict) -> List[Dict]:
        """문화예술 데이터 표준화"""
        normalized_data = []
        column_mapping = config.get('column_mapping', {})
        
        for item in raw_data:
            normalized_item = {
                'data_source': config['name'],
                'api_key': source_api,  # api_key를 사용
                'api_source': source_api,  # api_source에도 api_key 사용
                'category': config.get('category', '기타'),
                'institution_type': config.get('institution_type', '기타'),
                'location': config.get('location', '미상'),
                '수집시간': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # 컬럼 매핑 적용
            for source_field, target_field in column_mapping.items():
                # 서울시립미술관 아카이브는 fields 안에 데이터가 있음
                if source_api == 'sema_archive' and 'fields' in item:
                    if source_field in item['fields']:
                        normalized_item[target_field] = item['fields'][source_field]
                else:
                    if source_field in item:
                        normalized_item[target_field] = item[source_field]
            
            # 특별 API들의 추가 처리
            if source_api == 'sema_archive':
                normalized_item['연계기관명'] = '서울시립미술관'
                normalized_item['api_source'] = '서울시립미술관 아카이브'  # DB 조인 조건에 맞춤
                if 'location' in item and 'rowid' in item['location']:
                    normalized_item['전시ID'] = str(item['location']['rowid'])
            elif source_api == 'jeju_culture':
                # 제주 API 특별 처리
                normalized_item['연계기관명'] = '제주문화예술진흥원'
                normalized_item['api_source'] = '제주문화예술진흥원 공연전시정보'  # DB 조인 조건에 맞춤 (제주%로 매칭됨)
                if 'seq' in item:
                    normalized_item['전시ID'] = str(item['seq'])
                # 제주 API는 start와 end 필드가 같은 값을 가질 수 있음
                if 'start' in item:
                    normalized_item['시작일'] = item['start']
                if 'end' in item:
                    normalized_item['종료일'] = item['end']
            elif source_api == 'daegu_culture':
                # 대구 API 특별 처리
                normalized_item['연계기관명'] = '대구광역시'
                normalized_item['api_source'] = '대구광역시 공연전시정보'  # DB 조인 조건에 맞춤 (대구%로 매칭됨)
                if 'event_seq' in item:
                    normalized_item['전시ID'] = str(item['event_seq'])
                # 대구 API의 날짜 형식 처리
                if 'start_date' in item:
                    normalized_item['시작일'] = item['start_date']
                if 'end_date' in item:
                    normalized_item['종료일'] = item['end_date']
            
            # 표준 컬럼들 중 누락된 것들을 빈 값으로 채움
            for standard_col in self.cultural_standard_columns:
                if standard_col not in normalized_item:
                    normalized_item[standard_col] = ""
            
            # 필수 필드 검증 및 기본값 설정
            if not normalized_item.get('제목') or normalized_item.get('제목').strip() == '':
                # 제목이 없으면 다른 필드로 대체
                title_candidates = ['subject', 'title', 'I_TITLE', '장소', 'place', 'locNames']
                for candidate in title_candidates:
                    if candidate in item and item[candidate]:
                        normalized_item['제목'] = str(item[candidate]).strip()
                        break
                else:
                    # 모든 후보가 없으면 기본 제목 설정
                    normalized_item['제목'] = f"{config['name']} 문화행사 #{len(normalized_data) + 1}"
            
            # 연계기관명이 없으면 설정
            if not normalized_item.get('연계기관명') or normalized_item.get('연계기관명').strip() == '':
                if source_api == 'jeju_culture':
                    normalized_item['연계기관명'] = '제주문화예술진흥원'
                elif source_api == 'daegu_culture':
                    normalized_item['연계기관명'] = '대구광역시'
                elif source_api == 'sema_archive':
                    normalized_item['연계기관명'] = '서울시립미술관'
                else:
                    normalized_item['연계기관명'] = config['name']
            
            normalized_data.append(normalized_item)
        
        return normalized_data
    
    def run_cultural_hub_integration(self, max_pages: int = DEFAULT_MAX_PAGES, use_sequential: bool = False, progress_callback=None, cancel_check=None) -> Dict[str, Any]:
        
        # 디버깅: run_cultural_hub_integration에서 max_pages 값 확인
        import logging
        logging.info(f"DEBUG run_cultural_hub_integration: max_pages={max_pages}")
        
        # 우선순위별로 정렬
        sorted_apis = sorted(self.cultural_api_config.items(), key=lambda x: x[1].get('priority', 999))
        
        # 1단계: 안전한 문화 허브 API 테스트
        test_results = {}
        
        if use_sequential:
            print("순차 처리 모드 활성화 (문화기관 서버 부하 최소화)")
            for i, (api_key, config) in enumerate(sorted_apis, 1):
                # 취소 확인
                if cancel_check and cancel_check():
                    logger.info("API 테스트 중 취소 요청 감지")
                    break
                
                success, total_count, message = self.test_cultural_api_safely(api_key, config, cancel_check)
                test_results[api_key] = {
                    'success': success,
                    'total_count': total_count,
                    'message': message,
                    'config': config
                }
                
                institution_info = f"({config.get('institution_type', '기타')} / {config.get('location', '미상')})"
                if success:
                    print(f"SUCCESS ({i:2d}/{len(sorted_apis)}) [P{config.get('priority', '?'):2d}] {config['name']} {institution_info}: {message}")
                else:
                    print(f"FAILED ({i:2d}/{len(sorted_apis)}) [P{config.get('priority', '?'):2d}] {config['name']} {institution_info}: {message}")
        else:
            print("병렬 처리 모드 (빠른 테스트)")
            def test_single_cultural_api(api_item):
                api_key, config = api_item
                success, total_count, message = self.test_cultural_api_safely(api_key, config)
                return api_key, {
                    'success': success,
                    'total_count': total_count,
                    'message': message,
                    'config': config
                }
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.safe_config['max_workers']) as executor:
                futures = [executor.submit(test_single_cultural_api, api_item) for api_item in sorted_apis]
                
                for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                    api_key, result = future.result()
                    test_results[api_key] = result
                    config = result['config']
                    
                    institution_info = f"({config.get('institution_type', '기타')} / {config.get('location', '미상')})"
                    if result['success']:
                        print(f"SUCCESS ({i:2d}/{len(sorted_apis)}) [P{config.get('priority', '?'):2d}] {config['name']} {institution_info}: {result['message']}")
                    else:
                        print(f"FAILED ({i:2d}/{len(sorted_apis)}) [P{config.get('priority', '?'):2d}] {config['name']} {institution_info}: {result['message']}")
        
        # 성공한 문화기관 API들 추출
        working_cultural_apis = {
            api_key: result['config'] 
            for api_key, result in test_results.items() 
            if result['success']
        }
        
        success_count = len(working_cultural_apis)
        total_count = len(self.cultural_api_config)
        success_rate = (success_count / total_count) * 100
        
        print(f"\n{'='*120}")
        print(f"문화 허브 API 테스트 결과: {success_count}/{total_count}개 성공 ({success_rate:.1f}%)")
        
        if success_count == 0:
            print("FAILED: 모든 문화기관 API가 실패했습니다.")
            return {'success': False, 'message': '모든 문화기관 API 실패', 'test_results': test_results}
        
        # 성공한 문화기관들 카테고리별 분류
        categories = {}
        for api_key, config in working_cultural_apis.items():
            category = config.get('category', '기타')
            if category not in categories:
                categories[category] = []
            categories[category].append(config['name'])
        
        print(f"성공한 문화기관 카테고리별 현황:")
        for category, institutions in categories.items():
            print(f"{category}: {len(institutions)}개 기관")
            for institution in institutions:
                print(f"      - {institution}")
        
        print(f"{'='*120}")
        
        # 2단계: 성공한 문화기관 API에서 데이터 수집
        return self.collect_safely_from_cultural_apis(working_cultural_apis, max_pages, use_sequential, progress_callback, cancel_check)
    
    def collect_safely_from_cultural_apis(self, working_apis: Dict, max_pages: int = DEFAULT_MAX_PAGES, use_sequential: bool = False, progress_callback=None, cancel_check=None) -> Dict[str, Any]:
        """성공한 문화기관 API들에서 안전한 허브 데이터 수집"""
        
        print(f"\n{'='*120}")
        print(f"CulturalHub 안전 데이터 수집 시작 ({len(working_apis)}개 문화기관)")
        print(f"페이지 한계: {max_pages}페이지 (설정값 확인됨), 처리 모드: {'순차' if use_sequential else '병렬'}")
        print(f"{'='*120}")
        
        # 디버깅: max_pages 값 확인
        import logging
        logging.info(f"DEBUG: collect_safely_from_cultural_apis 호출됨 - max_pages={max_pages}")
        
        all_integrated_data = []
        collection_stats = {}
        working_sorted = sorted(working_apis.items(), key=lambda x: x[1].get('priority', 999))
        
        if use_sequential:
            # 순차 처리 모드
            for i, (api_key, config) in enumerate(working_sorted, 1):
                try:
                    # 진행 상황 업데이트 (시작) 및 취소 체크
                    if progress_callback:
                        if not progress_callback(4, f"데이터 수집 중... ({i}/{len(working_sorted)}) {config['name']}", {
                            'completed': i-1,
                            'total': len(working_sorted),
                            'current_api': config['name']
                        }):
                            logger.info(f"데이터 수집이 취소되었습니다 (API {i}/{len(working_sorted)})")
                            return {
                                'total_data_count': len(all_integrated_data),
                                'integrated_data': all_integrated_data,
                                'api_details': collection_stats,
                                'cancelled': True
                            }
                    
                    # 각 API 수집 전에 취소 확인
                    if cancel_check and cancel_check():
                        logger.info(f"수집이 취소되었습니다 (API: {config['name']})")
                        return {
                            'total_data_count': len(all_integrated_data),
                            'integrated_data': all_integrated_data,
                            'api_details': collection_stats,
                            'cancelled': True,
                            'success': False,
                            'message': '사용자가 수집을 취소했습니다'
                        }
                    
                    start_time = time.time()
                    raw_data = self.collect_cultural_data_safely(api_key, config, max_pages, cancel_check)
                    
                    if raw_data:
                        normalized_data = self.normalize_cultural_data(raw_data, api_key, config)
                        collection_time = time.time() - start_time
                        
                        all_integrated_data.extend(normalized_data)
                        collection_stats[api_key] = {
                            'name': config['name'],
                            'raw_count': len(raw_data),
                            'normalized_count': len(normalized_data),
                            'collection_time': collection_time,
                            'category': config.get('category', '기타'),
                            'institution_type': config.get('institution_type', '기타'),
                            'location': config.get('location', '미상'),
                            'endpoint': config['endpoint'],
                            'priority': config.get('priority', 999)
                        }
                        
                        rate = len(normalized_data) / collection_time if collection_time > 0 else 0
                        priority_info = f"[P{config.get('priority', '?')}]"
                        institution_info = f"({config.get('institution_type', '기타')} / {config.get('location', '미상')})"
                        
                        if api_key == 'museum_catalog':
                            label = " (SAFE MODE)"
                        elif api_key in ['mmca', 'integrated_exhibition', 'barrier_free']:
                            label = " (FIXED)"
                        elif api_key == 'mapo_art':
                            label = " (NEW)"
                        elif api_key == 'jeju_culture':
                            label = " (JEJU)"
                        elif api_key == 'daegu_culture':
                            label = " (DAEGU)"
                        else:
                            label = ""
                        
                        print(f"SUCCESS ({i}/{len(working_sorted)}) {priority_info} {config['name']} {institution_info}: {len(normalized_data)}개 데이터 ({collection_time:.1f}초, {rate:.1f}개/초){label}")
                        
                        # 진행 상황 업데이트 (완료)
                        if progress_callback:
                            progress_callback(4, f"데이터 수집 중... ({i}/{len(working_sorted)}) {config['name']} 완료", {
                                'completed': i,
                                'total': len(working_sorted),
                                'current_api': config['name']
                            })
                    else:
                        print(f"WARNING ({i}/{len(working_sorted)}) {priority_info} {config['name']}: 데이터 없음")
                        
                        # 진행 상황 업데이트 (완료 - 데이터 없음)
                        if progress_callback:
                            progress_callback(4, f"데이터 수집 중... ({i}/{len(working_sorted)}) {config['name']} 완료", {
                                'completed': i,
                                'total': len(working_sorted),
                                'current_api': config['name']
                            })
                        
                except Exception as e:
                    print(f"ERROR ({i}/{len(working_sorted)}) {config['name']}: 수집 오류 - {str(e)}")
                    
                    # 진행 상황 업데이트 (오류)
                    if progress_callback:
                        progress_callback(4, f"데이터 수집 중... ({i}/{len(working_sorted)}) {config['name']} 오류", {
                            'completed': i,
                            'total': len(working_sorted),
                            'current_api': config['name']
                        })
        else:
            # 병렬 처리 모드 (제한된 동시성)
            def collect_from_single_cultural_api(api_item):
                api_key, config = api_item
                try:
                    start_time = time.time()
                    raw_data = self.collect_cultural_data_safely(api_key, config, max_pages, cancel_check)
                    collection_time = time.time() - start_time
                    
                    if raw_data:
                        normalized_data = self.normalize_cultural_data(raw_data, api_key, config)
                        return api_key, {
                            'success': True,
                            'raw_data': raw_data,
                            'normalized_data': normalized_data,
                            'collection_time': collection_time,
                            'config': config
                        }
                    else:
                        return api_key, {'success': False, 'error': '데이터 없음', 'config': config}
                except Exception as e:
                    return api_key, {'success': False, 'error': str(e), 'config': config}
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.safe_config['max_workers']) as executor:
                futures = [executor.submit(collect_from_single_cultural_api, api_item) for api_item in working_sorted]
                
                for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                    api_key, result = future.result()
                    config = result['config']
                    
                    # 진행 상황 업데이트 (병렬 처리)
                    if progress_callback:
                        progress_callback(4, f"데이터 수집 중... ({i}/{len(working_sorted)}) {config['name']}", {
                            'completed': i,
                            'total': len(working_sorted),
                            'current_api': config['name']
                        })
                    
                    priority_info = f"[P{config.get('priority', '?')}]"
                    institution_info = f"({config.get('institution_type', '기타')} / {config.get('location', '미상')})"
                    
                    if result['success']:
                        normalized_data = result['normalized_data']
                        collection_time = result['collection_time']
                        
                        all_integrated_data.extend(normalized_data)
                        collection_stats[api_key] = {
                            'name': config['name'],
                            'raw_count': len(result['raw_data']),
                            'normalized_count': len(normalized_data),
                            'collection_time': collection_time,
                            'category': config.get('category', '기타'),
                            'institution_type': config.get('institution_type', '기타'),
                            'location': config.get('location', '미상'),
                            'endpoint': config['endpoint'],
                            'priority': config.get('priority', 999)
                        }
                        
                        rate = len(normalized_data) / collection_time if collection_time > 0 else 0
                        
                        if api_key == 'museum_catalog':
                            label = " (SAFE MODE)"
                        elif api_key in ['mmca', 'integrated_exhibition', 'barrier_free']:
                            label = " (FIXED)"
                        elif api_key == 'mapo_art':
                            label = " (NEW)"
                        elif api_key == 'jeju_culture':
                            label = " (JEJU)"
                        elif api_key == 'daegu_culture':
                            label = " (DAEGU)"
                        else:
                            label = ""
                        
                        print(f"SUCCESS ({i}/{len(working_sorted)}) {priority_info} {config['name']} {institution_info}: {len(normalized_data)}개 데이터 ({collection_time:.1f}초, {rate:.1f}개/초){label}")
                    else:
                        print(f"ERROR ({i}/{len(working_sorted)}) {priority_info} {config['name']} {institution_info}: {result['error']}")
        
        # 최종 결과
        total_data_count = len(all_integrated_data)
        successful_apis = len(collection_stats)
        
        print(f"\n{'='*120}")
        print(f"CulturalHub 데이터 수집 완료")
        print(f"성공한 문화기관: {successful_apis}/{len(working_apis)}개")
        print(f"총 수집 데이터: {total_data_count:,}개")
        
        if total_data_count > 0:
            # 카테고리별 통계
            category_stats = {}
            institution_stats = {}
            location_stats = {}
            
            for stat in collection_stats.values():
                category = stat['category']
                institution_type = stat['institution_type']
                location = stat['location']
                count = stat['normalized_count']
                
                category_stats[category] = category_stats.get(category, 0) + count
                institution_stats[institution_type] = institution_stats.get(institution_type, 0) + count
                location_stats[location] = location_stats.get(location, 0) + count
            
            print(f"\n카테고리별 데이터 현황:")
            for category, count in sorted(category_stats.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_data_count) * 100
                print(f"   {category}: {count:,}개 ({percentage:.1f}%)")
            
            print(f"\n기관 유형별 현황:")
            for inst_type, count in sorted(institution_stats.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_data_count) * 100
                print(f"   {inst_type}: {count:,}개 ({percentage:.1f}%)")
            
            print(f"\n지역별 현황:")
            for location, count in sorted(location_stats.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_data_count) * 100
                print(f"   {location}: {count:,}개 ({percentage:.1f}%)")
        
        print(f"{'='*120}")
        print(f"CulturalHub 완료! 전국 주요 문화예술기관 데이터 허브 구축 성공!")
        print(f"{'='*120}")
        
        # 데이터 수집 완료 알림 및 마지막 취소 체크
        if progress_callback:
            if not progress_callback(4, f"데이터 수집 완료! 총 {total_data_count}개 데이터 수집됨", {
                'completed': len(working_apis),
                'total': len(working_apis),
                'current_api': '모든 API 완료'
            }):
                logger.info("데이터 수집이 취소되었습니다 (최종 단계)")
                return {
                    'success': False,
                    'total_data_count': len(all_integrated_data),
                    'message': '사용자에 의해 취소됨',
                    'cancelled': True,
                    'integrated_data': all_integrated_data
                }
        
        return {
            'success': True,
            'total_data_count': total_data_count,
            'successful_apis': successful_apis,
            'total_apis': len(working_apis),
            'collection_stats': collection_stats,
            'integrated_data': all_integrated_data,
            'category_stats': category_stats if total_data_count > 0 else {},
            'institution_stats': institution_stats if total_data_count > 0 else {},
            'location_stats': location_stats if total_data_count > 0 else {}
        }

def main():
    """CulturalHub 시스템 실행"""
    print("CulturalHub 시작!")
    print("전국 주요 문화예술기관 API 안전 통합 허브 시스템")
    
    # CulturalHub 시스템 초기화
    hub = CulturalHubAPISystem()
    
    # 통합 데이터 수집 실행
    result = hub.run_cultural_hub_integration(max_pages=10, use_sequential=True)
    
    if result['success']:
        # CSV 파일로 저장 (순수 Python 구현)
        if result['integrated_data']:
            import csv
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"cultural_hub_data_{timestamp}.csv"
            
            # CSV 헤더 추출 (첫 번째 데이터의 키들)
            if result['integrated_data']:
                headers = list(result['integrated_data'][0].keys())
                
                with open(filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=headers)
                    writer.writeheader()
                    writer.writerows(result['integrated_data'])
                
                print(f"데이터 저장 완료: {filename}")
            
            # 상세 리포트 생성
            report_filename = f"cultural_hub_report_{timestamp}.txt"
            with open(report_filename, 'w', encoding='utf-8') as f:
                f.write("CulturalHub 문화예술 데이터 수집 보고서\n")
                f.write("=" * 80 + "\n")
                f.write(f"수집 시간: {datetime.now().strftime('%Y년 %m월 %d일 %H시 %M분')}\n")
                f.write(f"총 데이터: {result['total_data_count']:,}개\n")
                f.write(f"성공 기관: {result['successful_apis']}/{result['total_apis']}개\n\n")
                
                f.write("기관별 수집 현황:\n")
                for api_key, stats in result['collection_stats'].items():
                    f.write(f"- {stats['name']} ({stats['institution_type']} / {stats['location']}): {stats['normalized_count']}개\n")
                
                f.write(f"\n카테고리별 현황:\n")
                for category, count in result['category_stats'].items():
                    percentage = (count / result['total_data_count']) * 100
                    f.write(f"- {category}: {count:,}개 ({percentage:.1f}%)\n")
            
            print(f"보고서 저장 완료: {report_filename}")
        
        print("\nCulturalHub 성공적으로 완료!")
    else:
        print("\nCulturalHub 실행 중 문제가 발생했습니다.")

if __name__ == "__main__":
    main() 