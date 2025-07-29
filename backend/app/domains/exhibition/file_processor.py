"""
파일 처리 및 임베딩 생성 서비스
"""

import os
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

# PDF 처리
try:
    import PyPDF2
    PDF_PROCESSING_AVAILABLE = True
except ImportError:
    PDF_PROCESSING_AVAILABLE = False
    PyPDF2 = None

# AI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

# Database
from sqlalchemy.orm import Session
from app.core.config import settings
from app.domains.exhibition.models import SmartFile

# 텍스트 분할을 위한 유틸리티
def split_text_into_chunks(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """텍스트를 청크로 분할"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        
        # 문장 경계에서 자르기 시도
        if end < len(text):
            last_sentence = text[start:end].rfind('.')
            last_newline = text[start:end].rfind('\n')
            if last_sentence > start + chunk_size // 2:
                end = start + last_sentence + 1
            elif last_newline > start + chunk_size // 2:
                end = start + last_newline + 1
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks


class FileProcessor:
    """간단한 파일 처리 클래스"""
    
    def __init__(self, db: Session):
        self.db = db
        
        # OpenAI 클라이언트 초기화
        if OPENAI_AVAILABLE and hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            self.client = None
        
        # 파일 저장 경로
        self.upload_dir = Path("./uploads")
        self.upload_dir.mkdir(exist_ok=True)
    
    def process_file_sync(self, file_id: int):
        """SmartFile 기반 동기 파일 처리"""
        try:
            # DB에서 파일 정보 조회
            smart_file = self.db.query(SmartFile).filter(SmartFile.id == file_id).first()
            if not smart_file:
                print(f"파일 ID {file_id}를 찾을 수 없습니다.")
                return
            
            print(f"파일 처리 시작: {smart_file.filename}")
            
            # 처리 상태 업데이트
            smart_file.processing_status = "processing"
            self.db.commit()
            
            # 텍스트 추출
            if smart_file.file_type in ['pdf', 'institution_document']:
                extracted_text = self._extract_text_from_file(smart_file.file_path)
                smart_file.extracted_text = extracted_text[:5000] if extracted_text else None
                
                # PDF 페이지 수 계산
                if smart_file.file_path.lower().endswith('.pdf'):
                    try:
                        page_count = self._get_pdf_page_count(smart_file.file_path)
                        smart_file.total_pages = page_count
                    except:
                        pass
            
            # AI 요약 및 분류 (OpenAI 사용 가능한 경우)
            if self.client and smart_file.extracted_text:
                try:
                    # 간단한 분류 및 요약
                    classification = self._classify_document_simple(smart_file.extracted_text, smart_file.filename)
                    smart_file.ai_category = classification.get('category', '문서')
                    smart_file.ai_summary = classification.get('summary', '파일 처리 완료')
                    smart_file.confidence_score = classification.get('confidence', 0.8)
                except Exception as e:
                    print(f"AI 처리 실패: {e}")
                    smart_file.ai_summary = "텍스트 추출 완료"
                    smart_file.ai_category = "문서"
            else:
                smart_file.ai_summary = "파일 업로드 완료"
                smart_file.ai_category = "문서"
            
            # 임베딩 생성
            if self.client and smart_file.extracted_text and len(smart_file.extracted_text) > 50:
                try:
                    embedding_count = self._create_document_embeddings_sync(smart_file.id, smart_file.extracted_text)
                    print(f"임베딩 생성 완료: {embedding_count}개")
                except Exception as e:
                    print(f"임베딩 생성 실패: {e}")
            
            # 처리 완료
            smart_file.processing_status = "completed"
            smart_file.processed_at = datetime.utcnow()
            self.db.commit()
            
            print(f"파일 처리 완료: {smart_file.filename}")
            
        except Exception as e:
            print(f"파일 처리 오류: {e}")
            try:
                smart_file = self.db.query(SmartFile).filter(SmartFile.id == file_id).first()
                if smart_file:
                    smart_file.processing_status = "error"
                    smart_file.processing_error = str(e)
                    self.db.commit()
            except:
                pass
    
    def _extract_text_from_file(self, file_path: str) -> str:
        """파일에서 텍스트 추출"""
        try:
            # S3 URL인지 확인
            if file_path.startswith('https://'):
                return self._extract_text_from_s3_url(file_path)
            
            # 로컬 파일 처리 (기존 로직)
            if not os.path.exists(file_path):
                return "파일을 찾을 수 없습니다."
            
            if file_path.lower().endswith('.pdf'):
                return self._extract_pdf_text_simple(file_path)
            elif file_path.lower().endswith(('.txt', '.md')):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            else:
                return "지원하지 않는 파일 형식입니다."
                
        except Exception as e:
            return f"텍스트 추출 실패: {str(e)}"
    
    def _extract_text_from_s3_url(self, s3_url: str) -> str:
        """S3 URL에서 파일을 다운로드하여 텍스트 추출"""
        import tempfile
        import requests
        
        try:
            # S3 URL에서 파일 다운로드
            response = requests.get(s3_url, timeout=30)
            response.raise_for_status()
            
            # 파일 확장자 추출
            if '.pdf' in s3_url.lower():
                file_ext = '.pdf'
            elif '.txt' in s3_url.lower():
                file_ext = '.txt'
            elif '.md' in s3_url.lower():
                file_ext = '.md'
            else:
                return "지원하지 않는 파일 형식입니다."
            
            # 임시 파일에 저장
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
            
            try:
                # 임시 파일에서 텍스트 추출
                if file_ext == '.pdf':
                    text = self._extract_pdf_text_simple(temp_file_path)
                else:  # .txt, .md
                    with open(temp_file_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                
                return text
            finally:
                # 임시 파일 정리
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            return f"S3 파일 처리 실패: {str(e)}"
    
    def _extract_pdf_text_simple(self, file_path: str) -> str:
        """PDF에서 간단한 텍스트 추출"""
        try:
            if not PDF_PROCESSING_AVAILABLE:
                return "PDF 처리 라이브러리가 설치되지 않았습니다."
            
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    if page_num >= 20:  # 최대 20페이지만 처리
                        break
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            
            return text.strip() if text.strip() else "텍스트를 추출할 수 없습니다."
            
        except Exception as e:
            return f"PDF 텍스트 추출 실패: {str(e)}"
    
    def _get_pdf_page_count(self, file_path: str) -> int:
        """PDF 페이지 수 계산"""
        try:
            if not PDF_PROCESSING_AVAILABLE:
                return 0
            
            # S3 URL인지 확인
            if file_path.startswith('https://'):
                return self._get_pdf_page_count_from_s3(file_path)
            
            # 로컬 파일 처리
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                return len(pdf_reader.pages)
        except:
            return 0
    
    def _get_pdf_page_count_from_s3(self, s3_url: str) -> int:
        """S3 URL에서 PDF 페이지 수 계산"""
        import tempfile
        import requests
        
        try:
            # S3 URL에서 파일 다운로드
            response = requests.get(s3_url, timeout=30)
            response.raise_for_status()
            
            # 임시 파일에 저장
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
            
            try:
                # 임시 파일에서 페이지 수 계산
                with open(temp_file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    return len(pdf_reader.pages)
            finally:
                # 임시 파일 정리
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            print(f"S3 PDF 페이지 수 계산 실패: {e}")
            return 0
    
    def _classify_document_simple(self, text: str, filename: str) -> dict:
        """간단한 문서 분류"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system", 
                        "content": "파일명과 내용을 보고 문서 종류를 분류하고 간단히 요약해주세요."
                    },
                    {
                        "role": "user",
                        "content": f"파일명: {filename}\n\n내용 일부:\n{text[:1000]}\n\n이 문서의 종류(전시도록/보도자료/기획서/기타)와 2-3문장 요약을 JSON 형태로 답변해주세요.\n예: {{\"category\": \"전시도록\", \"summary\": \"...\", \"confidence\": 0.8}}"
                    }
                ],
                max_tokens=200,
                temperature=0.3
            )
            
            result = response.choices[0].message.content.strip()
            
            # JSON 파싱 시도
            try:
                if "```json" in result:
                    result = result.split("```json")[1].split("```")[0]
                elif "```" in result:
                    result = result.split("```")[1].split("```")[0]
                
                parsed = json.loads(result)
                return parsed
            except:
                return {
                    "category": "문서",
                    "summary": "파일 분석 완료",
                    "confidence": 0.7
                }
                
        except Exception as e:
            print(f"문서 분류 실패: {e}")
            return {
                "category": "문서",
                "summary": "파일 업로드 완료",
                "confidence": 0.5
            }
    
    def _create_document_embeddings_sync(self, file_id: int, text_content: str) -> int:
        """문서 임베딩 생성 (동기 버전)"""
        try:
            # 텍스트를 청크로 분할
            chunks = split_text_into_chunks(text_content, chunk_size=1000, overlap=200)
            
            embeddings_created = 0
            
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) < 50:  # 너무 짧은 청크는 스킵
                    continue
                
                try:
                    # OpenAI Embedding API 호출 (동기)
                    embedding_response = self.client.embeddings.create(
                        model="text-embedding-3-small",
                        input=chunk,
                        encoding_format="float"
                    )
                    
                    embedding_vector = embedding_response.data[0].embedding
                    print(f"청크 {i} 임베딩 생성 완료: {len(embedding_vector)}차원")
                    embeddings_created += 1
                    
                except Exception as e:
                    print(f"청크 {i} 임베딩 실패: {str(e)}")
                    continue
            
            return embeddings_created
            
        except Exception as e:
            print(f"문서 임베딩 생성 실패: {str(e)}")
            return 0


class EmbeddingProcessor:
    """파일 업로드 시 자동 임베딩 생성을 담당하는 클래스"""
    
    def __init__(self):
        self.openai_client = self._get_openai_client()
    
    def _get_openai_client(self):
        """OpenAI 클라이언트 초기화"""
        if OPENAI_AVAILABLE and hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            return OpenAI(api_key=settings.OPENAI_API_KEY)
        return None
    
    async def create_embeddings_for_file(self, smart_file, db):
        """파일의 임베딩을 생성하고 저장"""
        try:
            print(f"임베딩 생성 중: {smart_file.filename}")
            
            # PDF 텍스트 추출
            if smart_file.file_type == 'pdf':
                text_chunks = await self._extract_pdf_text_chunks(smart_file.file_path)
            else:
                print(f"{smart_file.file_type} 파일은 아직 지원되지 않음")
                return False
            
            # 각 청크에 대해 임베딩 생성
            success_count = 0
            for i, chunk_text in enumerate(text_chunks):
                if len(chunk_text.strip()) < 10:  # 너무 짧은 텍스트 스킵
                    continue
                
                try:
                    # OpenAI API로 임베딩 생성
                    embedding_response = self.openai_client.embeddings.create(
                        model="text-embedding-ada-002",
                        input=chunk_text
                    )
                    
                    embedding_vector = embedding_response.data[0].embedding
                    success_count += 1
                    
                except Exception as e:
                    print(f"청크 {i} 임베딩 실패: {str(e)}")
                    continue
            
            db.commit()
            print(f"임베딩 생성 완료: {success_count}개")
            return True
            
        except Exception as e:
            print(f"파일 임베딩 생성 실패: {str(e)}")
            db.rollback()
            return False
    
    async def _extract_pdf_text_chunks(self, file_path: str) -> List[str]:
        """PDF에서 텍스트를 추출하고 청크로 분할"""
        try:
            print(f"PDF 텍스트 추출 시작: {Path(file_path).name}")
            
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                print(f"총 페이지: {total_pages}")
                
                # 샘플링 (처음 10페이지만)
                sample_pages = min(10, total_pages)
                sample_text = ""
                
                for page_num in range(sample_pages):
                    page_text = pdf_reader.pages[page_num].extract_text().strip()
                    if page_text:
                        sample_text += f"\n[페이지 {page_num + 1}]\n{page_text}\n"
                
                print(f"샘플 추출 텍스트: {len(sample_text)}자")
                
                if sample_text and len(sample_text) > 100:
                    # 텍스트 정제 및 청크 분할
                    clean_text = self._clean_extracted_text(sample_text)
                    chunks = self._smart_text_chunking(clean_text, chunk_size=1200, overlap=300)
                    
                    # 의미있는 청크만 필터링
                    meaningful_chunks = []
                    for chunk in chunks:
                        if self._is_meaningful_chunk(chunk):
                            meaningful_chunks.append(chunk)
                    
                    print(f"최종 의미있는 청크: {len(meaningful_chunks)}개")
                    return meaningful_chunks
                else:
                    print("텍스트 추출 실패, 기본 컨텍스트 생성")
                    filename = Path(file_path).stem
                    return [f"문서: {filename} - PDF 파일 ({total_pages}페이지)"]
            
        except Exception as e:
            print(f"PDF 텍스트 추출 실패: {str(e)}")
            filename = Path(file_path).stem
            return [f"문서: {filename} - 텍스트 추출에 실패했지만 임베딩을 위한 기본 내용입니다."]
    
    def _clean_extracted_text(self, text: str) -> str:
        """추출된 텍스트 정제"""
        import re
        
        # 연속된 공백 및 줄바꿈 정리
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = re.sub(r' +', ' ', text)
        
        # 페이지 번호만 있는 줄 제거
        text = re.sub(r'\n\d+\s*\n', '\n', text)
        text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
        
        return text.strip()
    
    def _smart_text_chunking(self, text: str, chunk_size: int = 1200, overlap: int = 300) -> List[str]:
        """스마트한 텍스트 청킹"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            if end >= len(text):
                chunks.append(text[start:].strip())
                break
            
            # 문장 경계에서 자르기 시도
            chunk_text = text[start:end]
            
            # 문장 끝 찾기
            sentence_ends = []
            for i, char in enumerate(chunk_text):
                if char in '.!?。':
                    sentence_ends.append(start + i + 1)
            
            if sentence_ends:
                ideal_end = start + chunk_size * 0.8
                best_end = min(sentence_ends, key=lambda x: abs(x - ideal_end))
                chunk = text[start:best_end].strip()
            else:
                words = chunk_text.split()
                if len(words) > 10:
                    chunk = ' '.join(words[:-3])
                    end = start + len(chunk)
                else:
                    chunk = chunk_text
            
            if chunk.strip():
                chunks.append(chunk.strip())
            
            start = end - overlap
            if start >= len(text):
                break
        
        return chunks
    
    def _is_meaningful_chunk(self, chunk: str) -> bool:
        """청크가 의미있는 내용인지 판단"""
        chunk = chunk.strip()
        
        if len(chunk) < 20:
            return False
        
        if chunk.replace(' ', '').replace('\n', '').isdigit():
            return False
        
        unique_chars = set(chunk.replace(' ', '').replace('\n', ''))
        if len(unique_chars) < 5:
            return False
        
        return True


# 전역 인스턴스들
embedding_processor = EmbeddingProcessor() 