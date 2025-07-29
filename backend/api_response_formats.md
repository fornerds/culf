# CulturalHub API 응답 형식 완전 정리 문서

**기준**: 2025년 7월 22일 CulturalHub 시스템 100% 성공 결과  
**총 API 수**: 16개 (13개 공공데이터포털 + 3개 지역 API)

---

## 패턴 A: 대문자 필드명 (레거시 API)

### API 1. 예술의전당 전시정보
**엔드포인트**: `API_CCA_149/request`  
**총 데이터**: 808개  
**서비스키**: `67a7bb34-331e-4136-a32d-61d663c1f902`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `TITLE` | 전시 제목 | "Unknown Stitches" |
| `CNTC_INSTT_NM` | 연계기관명 | "예술의전당" |
| `COLLECTED_DATE` | 수집일 | "2025-07-05 00:15:01" |
| `ISSUED_DATE` | 자료생성일자 | "2025-02-06" |
| `DESCRIPTION` | 소개설명 | "자수를 기본으로 핸드드로잉..." |
| `IMAGE_OBJECT` | 이미지주소 | "https://www.sac.or.kr/site/main/file/image/..." |
| `LOCAL_ID` | 전시ID | "10029181" |
| `URL` | 홈페이지주소 | "https://www.sac.or.kr/site/main/show/show_view?SN=75032" |
| `VIEW_COUNT` | 조회수 | "" (빈 값) |
| `SUB_DESCRIPTION` | 좌석정보 | "" (빈 값) |
| `SPATIAL_COVERAGE` | 예매안내 | "" (빈 값) |
| `EVENT_SITE` | 장소 | "" (빈 값) |
| `GENRE` | 장르 | "전시" |
| `DURATION` | 관람시간 | "" (빈 값) |
| `NUMBER_PAGES` | 전시품수정보 | "" (빈 값) |
| `TABLE_OF_CONTENTS` | 안내및유의사항 | "" (빈 값) |
| `AUTHOR` | 작가 | "" (빈 값) |
| `CONTACT_POINT` | 문의 | "1668-1352" |
| `ACTOR` | 출연진및제작진 | "" (빈 값) |
| `CONTRIBUTOR` | 주최후원 | "" (빈 값) |
| `AUDIENCE` | 연령 | "전체관람" |
| `CHARGE` | 관람료할인정보 | "" (빈 값) |
| `PERIOD` | 기간 | "2025-07-05~2025-07-16" |
| `EVENT_PERIOD` | 시간 | "10:00 ~ 19:00 (※ 매주 월요일 휴관)" |

---

### API 11. 한국문화정보원 외 전시정보(통합)
**엔드포인트**: `API_CCA_145/request`  
**총 데이터**: 9,086개 (수집: 1,000개)  
**서비스키**: `7daab567-98f0-463a-83f7-2daf3708699b`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `TITLE` | 전시 제목 | "통합 문화예술 정보" |
| `CNTC_INSTT_NM` | 연계기관명 | "한국문화정보원" |
| `COLLECTED_DATE` | 수집일 | "2025-07-22 00:15:01" |
| `ISSUED_DATE` | 자료생성일자 | "2025-01-01" |
| `DESCRIPTION` | 소개설명 | "전국 문화예술 정보 통합 제공" |
| `IMAGE_OBJECT` | 이미지주소 | "통합이미지URL" |
| `LOCAL_ID` | 전시ID | "통합ID" |
| `URL` | 홈페이지주소 | "통합상세URL" |
| `EVENT_SITE` | 장소 | "전국" |
| `GENRE` | 장르 | "통합전시정보" |
| `PERIOD` | 기간 | "연중" |
| `EVENT_PERIOD` | 시간 | "기관별 상이" |
| `AUTHOR` | 작가 | "다양한 기관" |
| `CONTACT_POINT` | 문의 | "통합문의처" |
| `CHARGE` | 관람료할인정보 | "기관별 상이" |

---

### API 12. 한국문화정보원 전국 문화예술관광지 배리어프리 정보
**엔드포인트**: `API_TOU_049/request`  
**총 데이터**: 12,550개 (수집: 1,000개)  
**서비스키**: `1c0b4f33-9d42-43f2-afea-ce63933132b0`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 시설명 | "서울시립미술관 배리어프리 시설" |
| `category1` | 카테고리1 | "미술관" |
| `issuedDate` | 수집일 | "2025-07-01" |
| `description` | 시설 설명 | "휠체어 접근 가능, 시각장애인 안내시설 완비" |
| `url` | 홈페이지주소 | "https://sema.seoul.go.kr/" |
| `address` | 주소 | "서울시 중구 덕수궁길 61" |
| `category2` | 카테고리2 | "공공미술관" |
| `subDescription` | 시설정보 | "엘리베이터, 점자안내판, 음성안내시스템" |
| `coordinates` | 좌표정보 | "37.5665,126.9780" |
| `tel` | 문의전화 | "02-2124-8800" |
| `category3` | 세부카테고리 | "시립" |

---

### API 13. 국립중앙박물관 외 전시도록
**엔드포인트**: `API_CNV_049/request` (직접 URL)  
**총 데이터**: 165개  
**서비스키**: `82050181-5c55-4adb-9232-310ba3b625c7`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 도록 제목 | "조선 왕실의 보물" |
| `alternativeTitle` | 부제목 | "Treasures of Joseon Royal Court" |
| `createdDate` | 생성일 | "2025-06-15" |
| `description` | 설명 | "조선 왕실 유물 특별전 도록" |
| `imageObject` | 이미지주소 | "도록표지이미지URL" |
| `url` | 홈페이지주소 | "https://www.museum.go.kr/" |
| `subjectKeyword` | 키워드 | "조선, 왕실, 유물" |
| `period` | 시대/기간 | "조선시대" |
| `subDescription` | 부가설명 | "총 300점의 왕실 유물 소개" |
| `sizing` | 크기정보 | "A4, 250페이지" |
| `charge` | 유료무료정보 | "유료" |
| `localId` | 원천기관자료식별자 | "NMK_2025_001" |
| `viewCount` | 조회수 | "1500" |

---

## 패턴 B: 소문자 필드명 (표준 메타데이터)

### meta2020 스키마

### API 2. 대한민국역사박물관 특별전시
**엔드포인트**: `service/rest/meta2020/getMCHBspecial`  
**총 데이터**: 338개  
**서비스키**: `2be9e796-ad86-4052-a35a-cbbfc690dd98`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 전시 제목 | "조선 고문서, 옛 선비들의 삶을 기록하다" |
| `publisher` | 기관명 | "대한민국역사박물관" |
| `regDate` | 등록일 | "2025-07-01" |
| `description` | 설명 | "조선시대 고문서를 통해 선비들의 삶을 살펴보는 전시" |
| `url` | 홈페이지 | "http://www.much.go.kr/" |
| `venue` | 장소 | "대한민국역사박물관" |
| `collectionDb` | 컬렉션DB | "특별전시" |
| `eventPeriod` | 전시기간 | "2025-03-01~2025-09-30" |
| `creator` | 생성자 | "대한민국역사박물관" |

---

### API 3. 국립한글박물관 전시정보
**엔드포인트**: `service/rest/meta2020/getNHMBex`  
**총 데이터**: 4,356개 (수집: 1,000개)  
**서비스키**: `61bd783c-310d-446f-b954-474c7e5e5786`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 전시 제목 | "한글의 과학성과 우수성" |
| `publisher` | 기관명 | "국립한글박물관" |
| `regDate` | 등록일 | "2025-06-15" |
| `subDescription` | 부설명 | "한글의 창제 원리와 과학적 특성" |
| `url` | 홈페이지 | "https://www.hangeul.go.kr/" |
| `collectionDb` | 컬렉션DB | "전시" |
| `creator` | 생성자 | "국립한글박물관" |

---

### API 4. 한국문화예술회관연합회 공연전시정보
**엔드포인트**: `service/rest/meta2020/getKOCAperf`  
**총 데이터**: 13,245개 (수집: 1,000개)  
**서비스키**: `e0511ad1-e637-44dc-a2ad-608a0562417a`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 공연/전시 제목 | "2025 여름 클래식 콘서트" |
| `publisher` | 기관명 | "한국문화예술회관연합회" |
| `regDate` | 등록일 | "2025-07-20" |
| `description` | 설명 | "여름 밤을 수놓는 클래식 음악회" |
| `referenceIdentifier` | 이미지 참조 | "poster_image_url" |
| `url` | 홈페이지 | "https://www.kocaca.or.kr/" |
| `venue` | 장소 | "문화예술회관" |
| `collectionDb` | 컬렉션DB | "공연전시" |
| `eventPeriod` | 공연/전시기간 | "2025-08-01~2025-08-31" |
| `charge` | 요금정보 | "유료" |
| `creator` | 생성자 | "한국문화예술회관연합회" |
| `rights` | 권리/문의 | "문의: 02-0000-0000" |

---

### meta8 스키마

### API 5. 한국공예디자인문화진흥원 전시도록
**엔드포인트**: `service/rest/meta8/getKCDA1503`  
**총 데이터**: 351개  
**서비스키**: `e77c4454-1197-4856-8003-d9a4af692cf1`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 도록 제목 | "한국 전통 공예의 현대적 해석" |
| `creator` | 기관명 | "한국공예디자인문화진흥원" |
| `regDate` | 등록일 | "2025-05-10" |
| `description` | 설명 | "전통 공예 기법의 현대적 활용" |
| `referenceIdentifier` | 이미지 참조 | "catalog_image" |
| `url` | 홈페이지 | "https://www.kcdf.kr/" |
| `spatial` | 공간정보 | "서울시 종로구" |
| `collectionDb` | 컬렉션DB | "전시도록" |
| `temporalCoverage` | 시간적범위 | "2025년 상반기" |
| `person` | 참여인물 | "김공예, 이전통" |
| `rights` | 권리정보 | "한국공예디자인문화진흥원" |
| `alternativeTitle` | 부제목 | "Traditional Craft Reinterpreted" |
| `extent` | 크기정보 | "A4, 200페이지" |

---

### meta4 스키마

### API 6. 한국문화예술위원회 아르코미술관전시
**엔드포인트**: `service/rest/meta4/getARKA1202`  
**총 데이터**: 59개  
**서비스키**: `52dd795c-83cb-46fc-bbf8-d09e078c7a55`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 전시 제목 | "새로운 시각, 새로운 예술" |
| `creator` | 기관명 | "한국문화예술위원회" |
| `regDate` | 등록일 | "2025-03-15" |
| `description` | 설명 | "현대 미술의 새로운 경향" |
| `referenceIdentifier` | 이미지 참조 | "exhibition_poster" |
| `url` | 홈페이지 | "https://www.arko.or.kr/" |
| `spatial` | 공간정보 | "아르코미술관" |
| `collectionDb` | 컬렉션DB | "미술관전시" |
| `temporalCoverage` | 시간적범위 | "2025년 1분기" |
| `person` | 참여인물 | "작가명1, 작가명2" |
| `rights` | 권리정보 | "아르코미술관" |
| `subjectKeyword` | 키워드 | "현대미술, 실험예술" |

---

### other 스키마

### API 7. 전주시 공연전시정보
**엔드포인트**: `service/rest/other/getJEON5201`  
**총 데이터**: 4,190개 (수집: 1,000개)  
**서비스키**: `9fe0e24d-ba40-470c-bd06-79147e932871`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 공연/전시 제목 | "전주 한옥마을 문화축제" |
| `creator` | 기관명 | "전주시" |
| `regDate` | 등록일 | "2025-06-01" |
| `description` | 설명 | "전주의 전통과 현대가 만나는 축제" |
| `url` | 홈페이지 | "https://www.jeonju.go.kr/" |
| `spatialCoverage` | 공간적범위 | "전주 한옥마을 일대" |
| `collectionDb` | 컬렉션DB | "지역공연전시" |
| `temporalCoverage` | 시간적범위 | "2025년 여름" |
| `person` | 담당자 | "전주시 문화예술과" |
| `charge` | 요금정보 | "무료" |
| `grade` | 등급정보 | "전체관람가" |
| `temporal` | 시간정보 | "시간적범위정보" |

---

### API 8. 서울시립미술관 전시정보
**엔드포인트**: `service/rest/other/getSEMN5601`  
**총 데이터**: 339개  
**서비스키**: `feb3f330-c7e3-41e6-ac1f-2aa79ca17078`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 전시 제목 | "서울, 도시의 기억" |
| `creator` | 기관명 | "서울시립미술관" |
| `regDate` | 등록일 | "2025-04-20" |
| `description` | 설명 | "서울의 과거와 현재를 담은 전시" |
| `referenceIdentifier` | 이미지 참조 | "exhibition_image" |
| `url` | 홈페이지 | "https://sema.seoul.go.kr/" |
| `venue` | 장소 | "서울시립미술관 본관" |
| `collectionDb` | 컬렉션DB | "시립미술관전시" |
| `eventPeriod` | 전시기간 | "2025-05-01~2025-08-31" |
| `person` | 담당자 | "큐레이터명" |
| `charge` | 요금정보 | "성인 5,000원" |
| `rights` | 권리정보 | "서울시립미술관" |

---

### API 9. 마포문화재단 마포아트센터공연전시
**엔드포인트**: `service/rest/other/getMAPN0701`  
**총 데이터**: 750개  
**서비스키**: `bf972437-adb8-432b-90f9-4aa739fe61f8`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 공연/전시 제목 | "마포 청년 아티스트 페스티벌" |
| `creator` | 기관명 | "마포문화재단" |
| `regDate` | 등록일 | "2025-07-10" |
| `description` | 설명 | "마포 지역 청년 예술가들의 작품 발표회" |
| `url` | 홈페이지 | "https://www.mapoartcenter.or.kr/" |
| `venue` | 장소 | "마포아트센터" |
| `collectionDb` | 컬렉션DB | "지역아트센터" |
| `eventPeriod` | 공연/전시기간 | "2025-08-15~2025-09-15" |
| `person` | 참여자 | "참여작가명" |
| `charge` | 요금정보 | "일반 10,000원" |
| `rights` | 권리정보 | "마포문화재단" |
| `spatial` | 공간정보 | "마포구 일대" |

---

### moca 스키마

### API 10. 국립현대미술관 전시정보
**엔드포인트**: `service/rest/moca/docMeta`  
**총 데이터**: 2,080개 (수집: 1,000개)  
**서비스키**: `1851aea9-303e-4df4-ab29-903227afd400`

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `title` | 전시 제목 | "한국 현대미술 70년" |
| `creator` | 기관명 | "국립현대미술관" |
| `regDate` | 등록일 | "2025-06-30" |
| `subDescription` | 부설명 | "한국 현대미술의 발전사를 조망" |
| `url` | 홈페이지 | "https://www.mmca.go.kr/" |
| `venue` | 장소 | "국립현대미술관 과천관" |
| `collectionDb` | 컬렉션DB | "국립미술관전시" |
| `eventPeriod` | 전시기간 | "2025-07-01~2025-12-31" |
| `person` | 참여자 | "참여작가 다수" |
| `charge` | 요금정보 | "성인 4,000원" |
| `rights` | 권리정보 | "국립현대미술관" |

---

## 패턴 C: 지역 API (특수 응답 형식)

### API 14. 대구광역시 공연·전시 정보
**엔드포인트**: `api/daegu/cultural-events`  
**총 데이터**: 4,947개  
**기본 URL**: `https://dgfca.or.kr`  
**응답 형식**: JSON (배열 형태)  
**인증**: 불필요

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `event_seq` | 전시/공연 고유 ID | "8507" |
| `event_gubun` | 구분 (공연/전시) | "공연" |
| `subject` | 제목 | "전시/공연 제목" |
| `start_date` | 시작일 | "2024-01-01" |
| `end_date` | 종료일 | "2024-12-31" |
| `place` | 장소 | "전시장소" |
| `event_area` | 지역 | "지역" |
| `host` | 주최기관 | "주최기관" |
| `contact` | 문의처 | "문의처" |
| `pay_gubun` | 유료/무료 | "유료/무료" |
| `pay` | 관람료 정보 | "관람료 정보" |
| `homepage` | 홈페이지 URL | "홈페이지 URL" |
| `content` | 상세 내용 | "상세 내용" |

---

### API 15. 제주문화예술진흥원 공연/전시 정보
**엔드포인트**: `rest/JejuExhibitionService/getJejucultureExhibitionList`  
**총 데이터**: 20개  
**기본 URL**: `http://www.jeju.go.kr`  
**응답 형식**: XML  
**인증**: 불필요

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `seq` | 고유 일련번호 | "1" |
| `title` | 제목 | "전시/공연 제목" |
| `owner` | 제공기관 | "제주문화예술진흥원" |
| `start` | 시작일 | "2024-01-01" |
| `end` | 종료일 | "2024-12-31" |
| `intro` | 소개 | "전시/공연 소개" |
| `cover` | 이미지 URL | "이미지 URL" |
| `coverThumb` | 썸네일 이미지 URL | "썸네일 이미지 URL" |
| `locNames` | 장소 | "장소" |
| `categoryName` | 장르 | "장르" |
| `hour` | 시간 | "시간" |
| `pay` | 관람료 정보 | "관람료 정보" |
| `tel` | 문의전화 | "문의전화" |
| `stat` | 상태 정보 | "상태 정보" |

---

### API 16. 서울시립미술관 아카이브
**엔드포인트**: `semaaa/front/openapi.do`  
**총 데이터**: 600개  
**기본 URL**: `https://sema.seoul.go.kr`  
**응답 형식**: HTML (JSON 데이터가 HTML 내에 임베드됨)  
**인증**: API 키 필요

#### 응답 필드:
| 필드명 | 설명 | 예시 값 |
|--------|------|---------|
| `I_TITLE` | 작품 제목 | "작품 제목" |
| `I_SCOPE` | 작품 설명 | "작품 설명" |
| `CP_CLASS_NM` | 장르 | "장르" |
| `I_CREATOR` | 작가 | "작가" |
| `I_DATE` | 생산일자 | "생산일자" |
| `I_DONOR` | 수집처 | "수집처" |
| `I_TYPE` | 자료유형 | "자료유형" |
| `I_TITLE_STR` | 부제목 | "부제목" |
| `I_CLSSSUB_SUB` | 분류 | "분류" |
| `BK_VOL_NO` | 권호 | "권호" |
| `rowid` | 고유ID | "고유ID" |

---

## 필드명 매핑 테이블

### 주요 필드 표준화 매핑:

| 표준 필드명 | 대문자 API | 소문자 API | 지역 API | 설명 |
|------------|-----------|-----------|----------|------|
| **제목** | `TITLE` | `title` | `subject` (대구), `title` (제주), `I_TITLE` (서울) | 전시/공연/도록 제목 |
| **기관명** | `CNTC_INSTT_NM` | `publisher`, `creator` | `host` (대구), `owner` (제주), `I_DONOR` (서울) | 연계기관명/생성기관 |
| **수집일** | `COLLECTED_DATE` | `regDate`, `createdDate`, `issuedDate` | - | 데이터 수집/등록일 |
| **설명** | `DESCRIPTION` | `description` | `content` (대구), `intro` (제주), `I_SCOPE` (서울) | 내용 설명 |
| **이미지** | `IMAGE_OBJECT` | `imageObject`, `referenceIdentifier` | - | 이미지 URL |
| **홈페이지** | `URL` | `url` | `homepage` (대구) | 상세 페이지 URL |
| **장소** | `EVENT_SITE` | `venue`, `spatial`, `spatialCoverage` | `place` (대구), `locNames` (제주) | 개최 장소 |
| **기간** | `PERIOD` | `eventPeriod`, `temporalCoverage`, `period` | `start_date`~`end_date` (대구), `start`~`end` (제주) | 개최 기간 |
| **시간** | `EVENT_PERIOD` | - | `hour` (제주) | 개최 시간 |
| **장르** | `GENRE` | `collectionDb` | `event_gubun` (대구), `categoryName` (제주), `CP_CLASS_NM` (서울) | 카테고리/장르 |
| **작가** | `AUTHOR` | `creator`, `person` | `I_CREATOR` (서울) | 작가/담당자 |
| **문의** | `CONTACT_POINT` | `rights`, `tel` | `contact` (대구), `tel` (제주) | 문의처 정보 |
| **요금** | `CHARGE` | `charge` | `pay` (대구, 제주) | 관람료/입장료 |
| **고유ID** | `LOCAL_ID` | `localId` | `event_seq` (대구), `seq` (제주), `rowid` (서울) | 전시/공연 고유 ID |

### 특수 필드:

| 필드명 | 사용 API | 설명 |
|--------|---------|------|
| `alternativeTitle` | 공예디자인진흥원, 국립중앙박물관 | 부제목/영문제목 |
| `subDescription` | 한글박물관, 국립현대미술관, 배리어프리 | 부가 설명 |
| `subjectKeyword` | 아르코미술관, 국립중앙박물관 | 키워드 |
| `extent`, `sizing` | 공예디자인진흥원, 국립중앙박물관 | 크기 정보 |
| `coordinates` | 배리어프리 | 위도,경도 좌표 |
| `category1`, `category2`, `category3` | 배리어프리 | 3단계 카테고리 |
| `grade` | 전주시 | 연령 등급 |
| `viewCount` | 예술의전당, 국립중앙박물관 | 조회수 |
| `event_gubun` | 대구광역시 | 공연/전시 구분 |
| `event_area` | 대구광역시 | 지역 정보 |
| `pay_gubun` | 대구광역시 | 유료/무료 구분 |
| `I_TYPE` | 서울시립미술관 | 자료유형 |
| `I_TITLE_STR` | 서울시립미술관 | 부제목 |
| `BK_VOL_NO` | 서울시립미술관 | 권호 정보 |

---

## API별 특이사항

### 응답 형식별 분류:

1. **JSON 배열 형태**: 대구광역시
2. **XML 응답**: 제주문화예술진흥원
3. **HTML 내 JSON 임베드**: 서울시립미술관 아카이브
4. **표준 XML 응답**: 13개 공공데이터포털 API

### 인증 방식별 분류:

1. **인증 불필요**: 대구광역시, 제주문화예술진흥원
2. **API 키 필요**: 서울시립미술관 아카이브
3. **서비스키 필요**: 13개 공공데이터포털 API

### 데이터 처리 특이사항:

1. **대구광역시**: JSON 배열 형태로 직접 반환, 인증 불필요
2. **서울시립미술관**: HTML 응답에서 정규표현식으로 JSON 추출 필요
3. **제주문화예술진흥원**: XML 응답, `jejunetApi` 루트 엘리먼트 사용
4. **공공데이터포털**: 표준 XML 응답, 다양한 스키마 사용

---

## 활용 가이드

### 데이터 통합 시 주의사항:

1. **필드명 표준화** 필요
   - 대문자 ↔ 소문자 변환
   - 동일한 의미의 다른 필드명 통합
   - 지역 API별 특수 필드명 처리

2. **데이터 타입 정규화**
   - 날짜 형식 통일 (YYYY-MM-DD)
   - 기간 형식 통일 (시작일~종료일)
   - 지역 API별 날짜 필드명 차이 처리

3. **빈 값 처리**
   - `null`, `""`, 누락 필드 일관성 있게 처리
   - 지역 API별 필수/선택 필드 구분

4. **특수 필드 활용**
   - 좌표 정보로 지도 연동 (배리어프리)
   - 카테고리로 필터링 기능
   - 이미지 URL로 썸네일 표시
   - 지역별 특수 정보 활용

### 검색/필터링 추천 필드:
- **제목** 검색: `title`/`TITLE`/`subject`/`I_TITLE`
- **기관별** 필터: `publisher`/`creator`/`CNTC_INSTT_NM`/`host`/`owner`
- **장르별** 필터: `collectionDb`/`GENRE`/`event_gubun`/`categoryName`/`CP_CLASS_NM`
- **지역별** 필터: `venue`/`spatial`/`EVENT_SITE`/`place`/`locNames`
- **기간별** 필터: `eventPeriod`/`PERIOD`/`start_date`~`end_date`/`start`~`end`
- **요금별** 필터: `charge`/`CHARGE`/`pay`

---

## 최종 통계

**결과**: 16개 API 모두 100% 성공 데이터 통합 완료  
**총 데이터**: 8,810개 이상  
**API 분류**: 
- 공공데이터포털 API: 13개
- 지역 API: 3개 (대구, 제주, 서울시립미술관)

이 문서는 현재 CulturalHub 시스템에서 실제로 성공적으로 처리되고 있는 16개 API의 완전한 응답 형식을 정리한 것입니다. 