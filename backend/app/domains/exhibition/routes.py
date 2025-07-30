"""
전시 데이터 수집 API 라우터
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, text, func
from app.db.session import get_db
from app.core.config import settings
from .models import Exhibition, Institution, CultureHub, ApiSource, SmartFile
from .schemas import ExhibitionCreate, InstitutionCreate, InstitutionUpdate, CulturalHubCollectionRequest, CulturalHubCollectionResponse, CulturalHubStatusResponse, CulturalHubTestResponse, CulturalHubSyncRequest, CulturalHubSyncResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import uuid
import logging
import threading
import time

# CulturalHub 시스템 엔드포인트들 추가
from .cultural_hub_service import CulturalHubExhibitionService

router = APIRouter()

# 진행 상황 저장소
progress_store = {}

# 취소 요청 저장소
cancellation_requests = set()

# 실행 중인 스레드 저장소
running_threads = {}

# 기존 전시 관리 엔드포인트들
@router.get("/exhibitions", response_model=List[Dict[str, Any]])
def get_exhibitions(
    db: Session = Depends(get_db),
    institution_id: Optional[int] = Query(None, description="기관 ID"),
    category: Optional[str] = Query(None, description="카테고리"),
    is_active: Optional[bool] = Query(None, description="활성 상태"),
    admin_view: bool = Query(False, description="관리자 뷰 (모든 전시 조회)"),
    limit: int = Query(100, ge=1, le=1000, description="조회 개수"),
    offset: int = Query(0, ge=0, description="시작 위치")
):
    """전시 목록 조회 (관리자가 직접 입력한 Exhibition 데이터)"""
    try:
        # 삭제되지 않은 전시만 조회
        query = db.query(Exhibition).filter(Exhibition.is_deleted == False)
        
        # 관리자 뷰가 아니면 활성화된 전시만 조회
        if not admin_view:
            query = query.filter(Exhibition.is_active == True)
        
        if institution_id:
            query = query.filter(Exhibition.institution_id == institution_id)
        if category:
            query = query.filter(Exhibition.category == category)
        if is_active is not None:
            query = query.filter(Exhibition.is_active == is_active)
        
        exhibitions = query.offset(offset).limit(limit).all()
        
        return [
            {
                'id': ex.id,
                'title': ex.title,
                'subtitle': ex.subtitle,
                'description': ex.description,
                'start_date': ex.start_date.isoformat() if ex.start_date else None,
                'end_date': ex.end_date.isoformat() if ex.end_date else None,
                'venue': ex.venue,
                'address': ex.address,
                'category': ex.category,
                'genre': ex.genre,
                'artist': ex.artist,
                'host': ex.host,
                'contact': ex.contact,
                'price': ex.price,
                'website': ex.website,
                'image_url': ex.image_url,
                'keywords': ex.keywords,
                'status': ex.status,
                'institution_id': ex.institution_id,
                'is_active': ex.is_active,
                'created_at': ex.created_at.isoformat() if ex.created_at else None,
                'updated_at': ex.updated_at.isoformat() if ex.updated_at else None,
                'created_by': ex.created_by
            }
            for ex in exhibitions
        ]
    except Exception as e:
        import traceback
        error_msg = f"전시 조회 실패: {str(e)}"
        print(f"ERROR in get_exhibitions: {error_msg}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/exhibitions", response_model=Dict[str, Any])
def create_exhibition(exhibition_data: ExhibitionCreate, db: Session = Depends(get_db)):
    """새 전시 생성"""
    try:
        # 새 전시 객체 생성
        new_exhibition = Exhibition(
            institution_id=getattr(exhibition_data, 'institution_id', None),
            title=exhibition_data.title,
            subtitle=getattr(exhibition_data, 'subtitle', None),
            description=exhibition_data.description,
            start_date=exhibition_data.start_date,
            end_date=exhibition_data.end_date,
            venue=exhibition_data.venue,
            address=getattr(exhibition_data, 'address', None),
            category=exhibition_data.category or '전시',
            genre=getattr(exhibition_data, 'genre', None),
            artist=getattr(exhibition_data, 'artist', None),
            host=getattr(exhibition_data, 'host', None),
            contact=getattr(exhibition_data, 'contact', None),
            price=exhibition_data.price,
            website=getattr(exhibition_data, 'website', None),
            image_url=getattr(exhibition_data, 'image_url', None),
            keywords=getattr(exhibition_data, 'keywords', None),
            status=getattr(exhibition_data, 'status', 'active'),
            is_active=getattr(exhibition_data, 'is_active', True),
            created_by='admin'  # 실제로는 세션에서 가져와야 함
        )
        
        db.add(new_exhibition)
        db.commit()
        db.refresh(new_exhibition)
        
        return {
            "id": new_exhibition.id,
            "title": new_exhibition.title,
            "status": "success",
            "message": "전시가 성공적으로 등록되었습니다."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"전시 생성 실패: {str(e)}")


@router.put("/exhibitions/{exhibition_id}", response_model=Dict[str, Any])
def update_exhibition(exhibition_id: int, exhibition_data: ExhibitionCreate, db: Session = Depends(get_db)):
    """전시 정보 수정"""
    try:
        # 기존 전시 조회
        exhibition = db.query(Exhibition).filter(Exhibition.id == exhibition_id).first()
        if not exhibition:
            raise HTTPException(status_code=404, detail="전시를 찾을 수 없습니다.")
        
        # 필드 업데이트
        exhibition.institution_id = getattr(exhibition_data, 'institution_id', exhibition.institution_id)
        exhibition.title = exhibition_data.title
        exhibition.subtitle = getattr(exhibition_data, 'subtitle', exhibition.subtitle)
        exhibition.description = exhibition_data.description
        exhibition.start_date = exhibition_data.start_date if exhibition_data.start_date else exhibition.start_date
        exhibition.end_date = exhibition_data.end_date if exhibition_data.end_date else exhibition.end_date
        exhibition.venue = exhibition_data.venue
        exhibition.address = getattr(exhibition_data, 'address', exhibition.address)
        exhibition.category = exhibition_data.category or exhibition.category
        exhibition.genre = getattr(exhibition_data, 'genre', exhibition.genre)
        exhibition.artist = getattr(exhibition_data, 'artist', exhibition.artist)
        exhibition.host = getattr(exhibition_data, 'host', exhibition.host)
        exhibition.contact = getattr(exhibition_data, 'contact', exhibition.contact)
        exhibition.price = exhibition_data.price
        exhibition.website = getattr(exhibition_data, 'website', exhibition.website)
        exhibition.image_url = getattr(exhibition_data, 'image_url', exhibition.image_url)
        exhibition.keywords = getattr(exhibition_data, 'keywords', exhibition.keywords)
        exhibition.status = getattr(exhibition_data, 'status', exhibition.status)
        exhibition.is_active = getattr(exhibition_data, 'is_active', exhibition.is_active)
        
        db.commit()
        db.refresh(exhibition)
        
        return {
            "id": exhibition.id,
            "title": exhibition.title,
            "status": "success",
            "message": "전시가 성공적으로 수정되었습니다."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"전시 수정 실패: {str(e)}")


@router.delete("/exhibitions/{exhibition_id}", response_model=Dict[str, Any])
def delete_exhibition(exhibition_id: int, db: Session = Depends(get_db)):
    """전시 삭제 (소프트 삭제)"""
    try:
        exhibition = db.query(Exhibition).filter(Exhibition.id == exhibition_id).first()
        if not exhibition:
            raise HTTPException(status_code=404, detail="전시를 찾을 수 없습니다.")
        
        # 소프트 삭제
        exhibition.is_deleted = True
        db.commit()
        
        return {
            'message': '전시가 성공적으로 삭제되었습니다.'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"전시 삭제 실패: {str(e)}")


# 기관 관리 엔드포인트들
@router.get("/institutions", response_model=List[Dict[str, Any]])
def get_institutions(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="기관 유형"),
    category: Optional[str] = Query(None, description="카테고리"),
    include_inactive: bool = Query(False, description="비활성 기관 포함 여부"),
    limit: int = Query(100, ge=1, le=1000, description="조회 개수"),
    offset: int = Query(0, ge=0, description="시작 위치")
):
    """기관 목록 조회"""
    try:
        # 삭제되지 않은 기관만 조회
        query = db.query(Institution).filter(Institution.is_deleted == False)
        
        # include_inactive가 False면 활성 기관만 조회 (기본값)
        if not include_inactive:
            query = query.filter(Institution.is_active == True)
        
        if type:
            query = query.filter(Institution.type == type)
        if category:
            query = query.filter(Institution.category == category)
        
        institutions = query.offset(offset).limit(limit).all()
        
        return [
            {
                'id': inst.id,
                'name': inst.name,
                'type': inst.type,
                'category': inst.category,
                'contact': inst.contact,
                'email': inst.email,
                'website': inst.website,
                'manager': inst.manager,
                'address': inst.address,
                'description': inst.description,
                'is_active': inst.is_active,
                'created_at': inst.created_at.isoformat() if inst.created_at else None
            }
            for inst in institutions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"기관 조회 실패: {str(e)}")

@router.post("/institutions", response_model=Dict[str, Any])
def create_institution(
    institution_data: InstitutionCreate,
    db: Session = Depends(get_db)
):
    """기관 생성"""
    try:
        institution = Institution(**institution_data.dict())
        db.add(institution)
        db.commit()
        db.refresh(institution)
        
        return {
            'id': institution.id,
            'name': institution.name,
            'message': '기관이 성공적으로 등록되었습니다.'
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"기관 등록 실패: {str(e)}")

@router.put("/institutions/{institution_id}", response_model=Dict[str, Any])
def update_institution(
    institution_id: int,
    institution_data: InstitutionUpdate,
    db: Session = Depends(get_db)
):
    """기관 수정"""
    try:
        institution = db.query(Institution).filter(Institution.id == institution_id).first()
        if not institution:
            raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")
        
        update_data = institution_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(institution, key, value)
        
        db.commit()
        
        return {
            'id': institution.id,
            'name': institution.name,
            'message': '기관이 성공적으로 수정되었습니다.'
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"기관 수정 실패: {str(e)}")

@router.delete("/institutions/{institution_id}", response_model=Dict[str, Any])
def delete_institution(
    institution_id: int,
    db: Session = Depends(get_db)
):
    """기관 삭제"""
    try:
        institution = db.query(Institution).filter(Institution.id == institution_id).first()
        if not institution:
            raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")
        
        # 소프트 삭제
        institution.is_deleted = True
        db.commit()
        
        return {
            'message': '기관이 성공적으로 삭제되었습니다.'
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"기관 삭제 실패: {str(e)}")




# 파일 관리 엔드포인트들
@router.get("/institutions/{institution_id}/files", response_model=List[Dict[str, Any]])
def get_institution_files(
    institution_id: int,
    db: Session = Depends(get_db)
):
    """기관별 파일 목록 조회"""
    try:
        files = db.query(SmartFile).filter(
            SmartFile.institution_id == institution_id,
            SmartFile.is_active == True
        ).order_by(SmartFile.uploaded_at.desc()).all()
        
        return [
            {
                'file_id': file.id,
                'original_filename': file.filename,
                'file_url': file.file_path if file.file_path.startswith('https://') else f"/v1/exhibitions/files/{file.id}/download",
                'file_size': file.file_size,
                'file_type': file.file_type,
                'mime_type': file.mime_type,
                'processing_status': file.processing_status,
                'ai_summary': file.ai_summary,
                'ai_category': file.ai_category,
                'uploaded_at': file.uploaded_at.isoformat() if file.uploaded_at else None,
                'processed_at': file.processed_at.isoformat() if file.processed_at else None
            }
            for file in files
        ]
    except Exception as e:
        import traceback
        error_msg = f"파일 목록 조회 실패: {str(e)}"
        print(f"ERROR in get_institution_files: {error_msg}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/files/upload", response_model=Dict[str, Any])
async def upload_file(
    file: UploadFile = File(...),
    institution_id: Optional[str] = Form(None),
    exhibition_id: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """파일 업로드 (S3/로컬 저장)"""
    try:
        from pathlib import Path
        import os
        
        # 파일 확장자 검증
        allowed_extensions = {'.pdf', '.doc', '.docx', '.txt', '.md'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_extensions)}"
            )
        
        # 파일 크기 검증 (10MB 제한)
        max_size = 10 * 1024 * 1024  # 10MB
        content = await file.read()
        
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="파일 크기가 10MB를 초과합니다."
            )
        
        # 고유한 파일명 생성
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # AWS 설정 확인하여 S3 또는 로컬 저장 결정
        try:
            use_s3 = (
                hasattr(settings, 'AWS_ACCESS_KEY_ID') and 
                hasattr(settings, 'S3_BUCKET_NAME') and 
                getattr(settings, 'AWS_ACCESS_KEY_ID', None) and 
                getattr(settings, 'S3_BUCKET_NAME', None)
            )
            print(f"AWS 설정 확인: use_s3={use_s3}")
        except Exception as e:
            print(f"AWS 설정 확인 중 에러: {e}")
            use_s3 = False
        
        file_url = None
        
        if use_s3:
            try:
                # S3 저장
                from app.utils.s3_client import upload_file_to_s3
                from io import BytesIO
                
                object_name = f"exhibitions/files/{unique_filename}"
                file_obj = BytesIO(content)
                
                bucket_name = getattr(settings, 'S3_BUCKET_NAME', None)
                if not bucket_name:
                    raise Exception("S3_BUCKET_NAME이 설정되지 않았습니다")
                file_url = upload_file_to_s3(file_obj, bucket_name, object_name)
                if not file_url:
                    raise Exception("S3 업로드 실패")
                    
            except Exception as e:
                print(f"S3 업로드 실패, 로컬 저장으로 전환: {e}")
                use_s3 = False
        
        if not use_s3:
            # 로컬 저장
            upload_dir = Path("uploads")
            upload_dir.mkdir(exist_ok=True)
            file_path = upload_dir / unique_filename
            
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            file_url = str(file_path)
        
        # 데이터베이스에 파일 정보 저장
        smart_file = SmartFile(
            filename=file.filename,
            file_path=file_url,
            file_size=len(content),
            file_type=file_type or file_extension[1:],
            mime_type=file.content_type,
            institution_id=int(institution_id) if institution_id else None,
            exhibition_id=int(exhibition_id) if exhibition_id else None,
            processing_status="pending"
        )
        
        db.add(smart_file)
        db.commit()
        db.refresh(smart_file)
        
        # 백그라운드에서 임베딩 처리 시작
        try:
            from .file_processor import FileProcessor
            processor = FileProcessor(db)
            # 비동기로 처리하되 에러가 발생해도 업로드는 성공으로 처리
            import threading
            thread = threading.Thread(
                target=processor.process_file_sync,
                args=(smart_file.id,),
                daemon=True
            )
            thread.start()
        except Exception as e:
            print(f"임베딩 처리 시작 실패: {e}")
        
        return {
            'message': '파일이 성공적으로 업로드되었습니다.',
            'file_id': smart_file.id,
            'filename': file.filename,
            'file_url': file_url if use_s3 else f"/v1/exhibitions/files/{smart_file.id}/download",
            'size': len(content),
            'processing_status': 'pending'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_msg = f"파일 업로드 실패: {str(e)}"
        print(f"ERROR: {error_msg}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/files/{file_id}")
def get_file_info(file_id: int, db: Session = Depends(get_db)):
    """파일 정보 조회"""
    smart_file = db.query(SmartFile).filter(SmartFile.id == file_id).first()
    
    if not smart_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    
    return {
        'id': smart_file.id,
        'filename': smart_file.filename,
        'file_url': smart_file.file_path,
        'file_size': smart_file.file_size,
        'file_type': smart_file.file_type,
        'processing_status': smart_file.processing_status,
        'ai_summary': smart_file.ai_summary,
        'uploaded_at': smart_file.uploaded_at
    }


@router.get("/files")
def list_files(
    institution_id: Optional[int] = None,
    exhibition_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """파일 목록 조회"""
    query = db.query(SmartFile).filter(SmartFile.is_active == True)
    
    if institution_id:
        query = query.filter(SmartFile.institution_id == institution_id)
    if exhibition_id:
        query = query.filter(SmartFile.exhibition_id == exhibition_id)
    
    files = query.order_by(SmartFile.uploaded_at.desc()).all()
    
    return [
        {
            'id': file.id,
            'filename': file.filename,
            'file_url': file.file_path if file.file_path.startswith('https://') else f"/v1/exhibitions/files/{file.id}/download",
            'file_size': file.file_size,
            'file_type': file.file_type,
            'processing_status': file.processing_status,
            'uploaded_at': file.uploaded_at
        }
        for file in files
    ]

@router.get("/exhibitions/{exhibition_id}/files", response_model=List[Dict[str, Any]])
def get_exhibition_files(
    exhibition_id: int,
    db: Session = Depends(get_db)
):
    """전시별 파일 목록 조회"""
    try:
        files = db.query(SmartFile).filter(
            SmartFile.exhibition_id == exhibition_id,
            SmartFile.is_active == True
        ).order_by(SmartFile.uploaded_at.desc()).all()
        
        return [
            {
                'file_id': file.id,
                'original_filename': file.filename,
                'file_url': file.file_path if file.file_path.startswith('https://') else f"/v1/exhibitions/files/{file.id}/download",
                'file_size': file.file_size,
                'file_type': file.file_type,
                'mime_type': file.mime_type,
                'processing_status': file.processing_status,
                'ai_summary': file.ai_summary,
                'ai_category': file.ai_category,
                'uploaded_at': file.uploaded_at.isoformat() if file.uploaded_at else None,
                'processed_at': file.processed_at.isoformat() if file.processed_at else None
            }
            for file in files
        ]
    except Exception as e:
        import traceback
        error_msg = f"전시 파일 조회 실패: {str(e)}"
        print(f"ERROR in get_exhibition_files: {error_msg}")
        print(f"TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/files/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db)):
    """파일 다운로드"""
    from fastapi.responses import FileResponse, RedirectResponse
    import os
    from pathlib import Path
    
    smart_file = db.query(SmartFile).filter(
        SmartFile.id == file_id,
        SmartFile.is_active == True
    ).first()
    
    if not smart_file:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    
    # S3 파일인 경우 - 리다이렉트
    if smart_file.file_path.startswith('https://'):
        return RedirectResponse(url=smart_file.file_path)
    
    # 로컬 파일인 경우
    file_path = Path(smart_file.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일이 존재하지 않습니다.")
    
    return FileResponse(
        path=str(file_path),
        filename=smart_file.filename,
        media_type=smart_file.mime_type or 'application/octet-stream'
    )

@router.delete("/files/{file_id}", response_model=Dict[str, Any])
def delete_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    """파일 삭제 (S3 및 로컬 파일 모두 지원)"""
    try:
        from app.utils.s3_client import delete_file_from_s3
        import os
        from pathlib import Path
        import re
        
        # 파일 정보 조회
        smart_file = db.query(SmartFile).filter(SmartFile.id == file_id).first()
        if not smart_file:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        # 실제 파일 삭제
        try:
            if smart_file.file_path.startswith('https://'):
                # S3 파일 삭제
                # CloudFront URL에서 S3 객체 키 추출
                # 예: https://d123456.cloudfront.net/exhibitions/files/filename.pdf -> exhibitions/files/filename.pdf
                match = re.search(r'https://[^/]+/(.+)', smart_file.file_path)
                if match:
                    object_key = match.group(1)
                    delete_success = delete_file_from_s3(settings.S3_BUCKET_NAME, object_key)
                    if not delete_success:
                        print(f"S3 파일 삭제 실패: {object_key}")
                else:
                    print(f"S3 객체 키 추출 실패: {smart_file.file_path}")
            else:
                # 로컬 파일 삭제 (기존 로직)
                file_path = Path(smart_file.file_path)
                if file_path.exists():
                    os.remove(file_path)
                    
        except Exception as e:
            print(f"실제 파일 삭제 오류: {e}")
        
        # 데이터베이스에서 소프트 삭제
        smart_file.is_active = False
        db.commit()
        
        return {
            'message': '파일이 성공적으로 삭제되었습니다.'
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"파일 삭제 실패: {str(e)}")

# CultureHub 데이터 조회 엔드포인트들
@router.get("/events", response_model=Dict[str, Any])
def get_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색어 (제목, 장소, 작가)"),
    source: Optional[str] = Query(None, description="API 소스"),
    include_inactive: bool = Query(False, description="비활성 이벤트 포함 여부"),
    sort_by: str = Query("created_at", description="정렬 기준"),
    sort_order: str = Query("desc", description="정렬 순서 (asc/desc)")
):
    """문화행사 목록 조회 (페이지네이션)"""
    try:
        # 기본 쿼리
        query = db.query(CultureHub)
        if not include_inactive:
            query = query.filter(CultureHub.is_active == True)
        
        # 검색 조건
        if search:
            search_filter = or_(
                CultureHub.title.ilike(f"%{search}%"),
                CultureHub.venue.ilike(f"%{search}%"),
                CultureHub.artist.ilike(f"%{search}%"),
                CultureHub.description.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        # 소스 필터
        if source:
            query = query.filter(CultureHub.api_source == source)
        
        # 전체 개수
        total_count = query.count()
        
        # 정렬
        if sort_by == "created_at":
            order_field = CultureHub.created_at
        elif sort_by == "title":
            order_field = CultureHub.title
        elif sort_by == "start_date":
            order_field = CultureHub.start_date
        else:
            order_field = CultureHub.created_at
        
        if sort_order == "asc":
            query = query.order_by(order_field.asc())
        else:
            query = query.order_by(order_field.desc())
        
        # 페이지네이션
        offset = (page - 1) * size
        events = query.offset(offset).limit(size).all()
        
        # 페이지 계산
        total_pages = (total_count + size - 1) // size
        
        return {
            'items': [
            {
                'id': event.id,
                'title': event.title,
    
                'description': event.description,
                    'start_date': event.start_date.isoformat() if event.start_date else None,
                    'end_date': event.end_date.isoformat() if event.end_date else None,
                'venue': event.venue,
                'category': event.category,
                'artist': event.artist,
                'price': event.price,
                'website': event.website,
                'image_url': event.image_url,
                    'api_source': event.api_source,
                'is_active': event.is_active,
    
                    'collected_at': event.collected_at.isoformat() if event.collected_at else None,
                    'created_at': event.created_at.isoformat() if event.created_at else None
            }
            for event in events
            ],
            'total': total_count,
            'page': page,
            'size': size,
            'pages': total_pages
        }
    except Exception as e:
        logging.error(f"문화행사 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"문화행사 조회 실패: {str(e)}")

# API 상태 관리 엔드포인트들
@router.get("/cultural-hub/status")
def get_cultural_hub_status(db: Session = Depends(get_db)):
    """CulturalHub 상태 조회"""
    try:
        # 전체 통계 (OpenAPI로 수집된 CultureHub 데이터만)
        total_events = db.query(CultureHub).filter(CultureHub.is_active == True).count()
        
        # API 상태 테이블에서 데이터 조회
        api_sources = db.query(ApiSource).order_by(ApiSource.name).all()
        
        # 실제 DB의 api_source 값들 조회
        actual_api_sources = db.query(CultureHub.api_source, func.count(CultureHub.id)).group_by(CultureHub.api_source).all()
        actual_api_map = {api_source: count for api_source, count in actual_api_sources}
        
        # API 키와 실제 저장된 이름 매핑 (3개만 특별 처리, 나머지는 api_key 그대로)
        api_key_to_stored_name = {
            # 특별 처리되는 3개 API만 매핑
            'jeju_culture': '제주문화예술진흥원 공연전시정보',
            'daegu_culture': '대구광역시 공연전시정보',
            'sema_archive': '서울시립미술관 아카이브'
            # 나머지 13개는 api_key 그대로 저장됨
        }
        
        # 실시간 데이터 수 업데이트
        all_api_sources = []
        for api_source in api_sources:
            # 실제 저장된 이름으로 데이터 수 조회
            # 특별 처리되는 3개는 매핑된 이름, 나머지는 api_key 그대로
            stored_name = api_key_to_stored_name.get(api_source.api_key, api_source.api_key)
            data_count = actual_api_map.get(stored_name, 0)
            
            # 마지막 수집 시간
            last_sync = None
            if api_source.last_collection_at:
                last_sync = api_source.last_collection_at.isoformat()
            
            # 지역 정보 매핑
            location_mapping = {
                'arts_center': '서울',
                'history_museum': '서울',
                'hangeul_museum': '서울',
                'kocaca': '서울',
                'kcdf': '서울',
                'arko': '서울',
                'jeonju_culture': '전주',
                'sema': '서울',
                'mapo_art': '서울',
                'mmca': '서울',
                'integrated_exhibition': '전국',
                'barrier_free': '전국',
                'museum_catalog': '서울',
                'jeju_culture': '제주',
                'daegu_culture': '대구',
                'sema_archive': '서울'
            }
            
            all_api_sources.append({
                'api_key': api_source.api_key,
                'name': api_source.name,
                'data_count': data_count,
                'is_active': api_source.is_active,
                'status': '활성' if api_source.is_active else '비활성',
                'last_sync': last_sync,
                'total_collected': api_source.total_collected,
                'location': location_mapping.get(api_source.api_key, '미상')
            })
        
        # 시스템 요약
        active_apis = len([s for s in all_api_sources if s['is_active']])
        last_syncs = [s['last_sync'] for s in all_api_sources if s['last_sync']]
        last_updated = max(last_syncs) if last_syncs else None
        
        # 지역 수 계산
        unique_locations = set(s['location'] for s in all_api_sources if s['location'] != '미상')
        total_locations = len(unique_locations)
        
        # 실제 운영 중인 API 개수 (16개)
        total_defined_apis = 16
        
        return {
            'summary': {
                'total_events': total_events,
                'active_apis': active_apis,
                'total_apis': total_defined_apis,  # 실제 정의된 API 개수 사용
                'total_locations': total_locations,
                'last_updated': last_updated
            },
            'api_sources': all_api_sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {str(e)}")

# API 상태 체크 엔드포인트
@router.get("/cultural-hub/test/{api_key}")
def test_single_api(api_key: str, db: Session = Depends(get_db)):
    """단일 API 상태 체크 (실제 수집 없이 연결 테스트만)"""
    try:
        from .cultural_hub_ai_system import CulturalHubAPISystem
        
        # API 시스템 초기화
        api_system = CulturalHubAPISystem()
        
        # 해당 API 설정 확인
        if api_key not in api_system.cultural_api_config:
            raise HTTPException(status_code=404, detail=f"API 키 '{api_key}'를 찾을 수 없습니다")
        
        config = api_system.cultural_api_config[api_key]
        
        # API 연결 테스트 (1회만, 데이터 저장 없음)
        success, total_count, message = api_system.test_cultural_api_safely(api_key, config)
        
        return {
            "success": success,
            "api_key": api_key,
            "api_name": config['name'],
            "total_available": total_count if success else 0,
            "message": message,
            "test_time": datetime.now().isoformat(),
            "status": "정상" if success else "오류"
        }
        
    except Exception as e:
        logger.error(f"API 테스트 실패 ({api_key}): {str(e)}")
        raise HTTPException(status_code=500, detail=f"API 테스트 실패: {str(e)}")

# 데이터 수집 엔드포인트들
@router.post("/cultural-hub/collect")
async def collect_cultural_data(
    config: Optional[CulturalHubCollectionRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """문화 데이터 수집 - 백그라운드 실행"""
    try:
        # 진행 상황 ID 생성
        progress_id = str(uuid.uuid4())
        
        # 설정 파라미터 추출
        if config is None:
            max_pages = 1
            use_sequential = True
            incremental = True
        else:
            max_pages = config.max_pages if config.max_pages is not None else 1
            use_sequential = config.use_sequential if config.use_sequential is not None else True
            incremental = config.incremental if config.incremental is not None else True
        
        # 초기 진행 상황 설정
        progress_store[progress_id] = {
            'step': 1,
            'message': '데이터 수집을 시작합니다...',
            'percentage': 5,
            'completed': False,
            'error': None
        }
        
        logging.info(f"데이터 수집 시작: max_pages={max_pages}, sequential={use_sequential}, incremental={incremental}")
        
        # 스레드에서 실행 (즉시 응답 가능)
        thread = threading.Thread(
            target=run_collection_with_progress_sync,
            args=(progress_id, max_pages, use_sequential, incremental),
            daemon=True
        )
        running_threads[progress_id] = thread
        thread.start()
        
        return {
            'success': True,
            'progress_id': progress_id,
            'message': '데이터 수집이 시작되었습니다'
        }
        
    except Exception as e:
        logging.error(f"데이터 수집 시작 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"데이터 수집 시작 실패: {str(e)}")

@router.post("/cultural-hub/collect/{api_key}")
async def collect_single_api(
    api_key: str,
    config: Optional[CulturalHubCollectionRequest] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """개별 API 데이터 수집 - 백그라운드 실행"""
    try:
        # 진행 상황 ID 생성
        progress_id = str(uuid.uuid4())
        
        # 설정 파라미터 추출
        if config is None:
            max_pages = 1
            use_sequential = True
            incremental = True
        else:
            max_pages = config.max_pages if config.max_pages is not None else 1
            use_sequential = config.use_sequential if config.use_sequential is not None else True
            incremental = config.incremental if config.incremental is not None else True
        
        # 초기 진행 상황 설정
        progress_store[progress_id] = {
            'step': 1,
            'message': f'{api_key} API 데이터 수집을 시작합니다...',
            'percentage': 5,
            'completed': False,
            'error': None
        }
        
        logging.info(f"개별 API 수집 시작: {api_key}, max_pages={max_pages}, sequential={use_sequential}, incremental={incremental}")
        
        # 스레드에서 실행 (즉시 응답 가능)
        thread = threading.Thread(
            target=run_single_api_collection_sync,
            args=(progress_id, api_key, max_pages, use_sequential, incremental),
            daemon=True
        )
        running_threads[progress_id] = thread
        thread.start()
        
        return {
            'success': True,
            'progress_id': progress_id,
            'message': f'{api_key} API 데이터 수집이 시작되었습니다'
        }
        
    except Exception as e:
        logging.error(f"개별 API 수집 시작 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"개별 API 수집 시작 실패: {str(e)}")

@router.get("/cultural-hub/collect/progress/{progress_id}")
async def get_progress(progress_id: str):
    """진행 상황 조회"""
    if progress_id in progress_store:
        return progress_store[progress_id]
    return {
        'step': 0,
        'message': '진행 상황을 찾을 수 없습니다',
        'percentage': 0,
        'completed': True,
        'error': '진행 상황을 찾을 수 없습니다'
    }

@router.post("/cultural-hub/collect/cancel/{progress_id}")
async def cancel_collection(progress_id: str):
    """데이터 수집 취소"""
    try:
        # 취소 요청 등록
        cancellation_requests.add(progress_id)
        
        # 진행 상황 업데이트 (있는 경우)
        if progress_id in progress_store:
            progress_store[progress_id].update({
                'cancelled': True,
                'completed': True,
                'message': '사용자에 의해 취소되었습니다',
                'percentage': 100
            })
        
        logging.info(f"데이터 수집 취소 요청: {progress_id}")
        
        return {
            'success': True,
            'message': '수집 취소 요청이 접수되었습니다',
            'cancelled': True
        }
        
    except Exception as e:
        logging.error(f"취소 요청 처리 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"취소 요청 실패: {str(e)}")







@router.delete("/cultural-hub/collect/force-stop")
async def force_stop_all_collections():
    """모든 진행 중인 수집 작업 강제 중단"""
    try:
        stopped_count = 0
        
        # 모든 진행 중인 작업을 취소로 마킹
        for progress_id, progress_data in progress_store.items():
            if not progress_data.get('completed', False):
                cancellation_requests.add(progress_id)
                progress_store[progress_id].update({
                    'cancelled': True,
                    'completed': True,
                    'message': '관리자에 의해 강제 중단되었습니다',
                    'percentage': 100
                })
                stopped_count += 1
        
        # 진행 중인 스레드들도 정리
        for progress_id in list(running_threads.keys()):
            thread = running_threads[progress_id]
            if thread.is_alive():
                logging.info(f"스레드 {progress_id} 강제 종료 대기 중...")
            del running_threads[progress_id]
        
        logging.info(f"강제 중단된 작업 수: {stopped_count}")
        
        return {
            'success': True,
            'message': f'{stopped_count}개의 작업이 강제 중단되었습니다',
            'stopped_count': stopped_count
        }
        
    except Exception as e:
        logging.error(f"강제 중단 처리 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"강제 중단 실패: {str(e)}")

def run_collection_with_progress_sync(progress_id: str, max_pages: int, use_sequential: bool, incremental: bool):
    """진행 상황을 업데이트하면서 데이터 수집 실행"""
    try:
        from ...db.session import SessionLocal
        
        def update_progress(step: int, message: str, percentage: int):
            # 취소 요청 확인
            if progress_id in cancellation_requests:
                if progress_id in progress_store:
                    progress_store[progress_id].update({
                        'step': step,
                        'message': '사용자에 의해 취소되었습니다',
                        'percentage': 100,
                        'completed': True,
                        'cancelled': True
                    })
                return False
            
            if progress_id in progress_store:
                progress_store[progress_id].update({
                    'step': step,
                    'message': message,
                    'percentage': percentage,
                    'completed': False
                })
                return True
            return False
        
        # 새로운 DB 세션 생성
        db = SessionLocal()
        
        try:
            cultural_service = CulturalHubExhibitionService(db)
            
            # 단계별 진행 상황 업데이트 (각 단계에서 취소 확인)
            if not update_progress(2, 'API 연결을 확인하는 중...', 10):
                logging.info(f"데이터 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            if not update_progress(3, '데이터 소스를 초기화하는 중...', 20):
                logging.info(f"데이터 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            if not update_progress(4, '문화 데이터를 수집하는 중...', 30):
                logging.info(f"데이터 수집이 취소되었습니다: {progress_id}")
                return
            
            # 데이터 수집 실행 (취소 확인 콜백 포함)
            def collection_progress_callback(step, message, api_info=None):
                # 취소 확인
                if progress_id in cancellation_requests:
                    logging.info(f"수집 중 취소 감지: {progress_id}")
                    return False
                # 진행 상황 업데이트
                return update_progress(4, f"API 수집 중: {message}", min(30 + (step * 10), 80))
            
            def cancel_check():
                return progress_id in cancellation_requests
            
            # 동기 버전으로 호출
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(cultural_service.collect_all_exhibitions_safely(
                    max_pages=max_pages, 
                    use_sequential=use_sequential,
                    incremental=incremental,
                    progress_callback=collection_progress_callback,
                    cancel_check=cancel_check
                ))
            finally:
                loop.close()
            
            if not update_progress(6, '수집된 데이터를 검증하는 중...', 85):
                logging.info(f"데이터 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            if not update_progress(7, '데이터베이스에 저장하는 중...', 95):
                logging.info(f"데이터 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            # 완료 (취소되지 않은 경우만)
            if progress_id not in cancellation_requests:
                progress_store[progress_id].update({
                    'step': 8,
                    'message': '데이터 수집이 완료되었습니다',
                    'percentage': 100,
                    'completed': True,
                    'results': result
                })
                
                logging.info(f"수집 완료: success={result['success']}")
                if result['success']:
                    logging.info(f"총 데이터 수: {result.get('total_collected', 0)}")
                
        finally:
            # 취소 요청 정리
            if progress_id in cancellation_requests:
                cancellation_requests.remove(progress_id)
                logging.info(f"취소 요청 정리 완료: {progress_id}")
            
            # 스레드 정리
            if progress_id in running_threads:
                del running_threads[progress_id]
                logging.info(f"스레드 정리 완료: {progress_id}")
            
            db.close()

    except Exception as e:
        logging.error(f"수집 작업 오류: {str(e)}")
        if progress_id in progress_store:
            progress_store[progress_id].update({
                'step': 8,
                'message': f'오류 발생: {str(e)}',
                'percentage': 100,
                'completed': True,
                'error': str(e)
            })


def run_single_api_collection_sync(progress_id: str, api_key: str, max_pages: int, use_sequential: bool, incremental: bool):
    """개별 API 데이터 수집 실행"""
    try:
        from ...db.session import SessionLocal
        
        def update_progress(step: int, message: str, percentage: int):
            # 취소 요청 확인
            if progress_id in cancellation_requests:
                if progress_id in progress_store:
                    progress_store[progress_id].update({
                        'step': step,
                        'message': '사용자에 의해 취소되었습니다',
                        'percentage': 100,
                        'completed': True,
                        'cancelled': True
                    })
                return False
            
            if progress_id in progress_store:
                progress_store[progress_id].update({
                    'step': step,
                    'message': message,
                    'percentage': percentage,
                    'completed': False
                })
                return True
            return False
        
        # 새로운 DB 세션 생성
        db = SessionLocal()
        
        try:
            cultural_service = CulturalHubExhibitionService(db)
            
            # 단계별 진행 상황 업데이트
            if not update_progress(2, f'{api_key} API 연결을 확인하는 중...', 10):
                logging.info(f"개별 API 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            if not update_progress(3, f'{api_key} API 데이터를 수집하는 중...', 30):
                logging.info(f"개별 API 수집이 취소되었습니다: {progress_id}")
                return
            
            # 개별 API 수집 실행
            def collection_progress_callback(step, message, api_info=None):
                # 취소 확인
                if progress_id in cancellation_requests:
                    logging.info(f"개별 수집 중 취소 감지: {progress_id}")
                    return False
                # 진행 상황 업데이트
                return update_progress(4, f"{api_key}: {message}", min(40 + (step * 15), 80))
            
            def cancel_check():
                return progress_id in cancellation_requests
            
            # 개별 API 수집 (동기 버전으로 호출)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(cultural_service.collect_single_api_safely(
                    api_key=api_key,
                    max_pages=max_pages,
                    use_sequential=use_sequential,
                    incremental=incremental,
                    progress_callback=collection_progress_callback,
                    cancel_check=cancel_check
                ))
            finally:
                loop.close()
            
            if not update_progress(6, f'{api_key} 수집된 데이터를 검증하는 중...', 85):
                logging.info(f"개별 API 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            if not update_progress(7, f'{api_key} 데이터베이스에 저장하는 중...', 95):
                logging.info(f"개별 API 수집이 취소되었습니다: {progress_id}")
                return
            time.sleep(0.5)
            
            # 완료 (취소되지 않은 경우만)
            if progress_id not in cancellation_requests:
                progress_store[progress_id].update({
                    'step': 8,
                    'message': f'{api_key} API 수집이 완료되었습니다',
                    'percentage': 100,
                    'completed': True,
                    'results': result
                })
                
                logging.info(f"개별 API 수집 완료: {api_key}, success={result.get('success', False)}")
                
        finally:
            # 취소 요청 정리
            if progress_id in cancellation_requests:
                cancellation_requests.remove(progress_id)
                logging.info(f"개별 수집 취소 요청 정리 완료: {progress_id}")
            
            # 스레드 정리
            if progress_id in running_threads:
                del running_threads[progress_id]
                logging.info(f"개별 수집 스레드 정리 완료: {progress_id}")
            
            db.close()
        
    except Exception as e:
        logging.error(f"개별 API 수집 오류: {str(e)}")
        if progress_id in progress_store:
            progress_store[progress_id].update({
                'step': 8,
                'message': f'{api_key} 수집 중 오류 발생: {str(e)}',
                'percentage': 100,
                'completed': True,
                'error': str(e)
            })