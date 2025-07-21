from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.domains.user import routes as user_routes
from app.domains.conversation import routes as conversation_routes
from app.domains.token import routes as token_routes
from app.domains.notification import routes as notification_routes
from app.domains.notice import routes as notice_routes
from app.domains.inquiry import routes as inquiry_routes
from app.domains.terms import routes as terms_routes
from app.domains.curator import routes as curator_routes
from app.domains.banner import routes as banner_routes
from app.domains.auth import routes as auth_routes
from app.domains.admin import routes as admin_routes
from app.domains.subscription import routes as subscription_routes
from app.domains.payment import routes as payment_routes
from app.domains.footer import routes as footer_routes
from app.domains.exhibition import routes as exhibition_routes
from app.domains.exhibition.cultural_hub_service import setup_cultural_data_sources
from app.db.session import get_db
from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from fastapi.security import OAuth2
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    cul.f API 서비스

    주요 기능:
    - 사용자 인증 및 관리
    - 대화 생성 (텍스트 및 이미지 업로드 지원)
    - 스톤 관리
    - 알림 관리
    - 관리자 기능
    """,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 개발 모드에서 인증을 우회하는 미들웨어
@app.middleware("http")
async def dev_mode_middleware(request: Request, call_next):
    if settings.DEV_MODE:
        # 개발 모드에서는 Authorization 헤더를 추가
        request.headers.__dict__["_list"].append(
            (b'authorization', b'Bearer dev_token')
        )
    response = await call_next(request)
    return response


# 커스텀 예외 핸들러 추가
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    for error in errors:
        # Handle empty file submissions
        if (error["loc"][0] == "body" and
                len(error["loc"]) >= 2 and
                error["loc"][1] == "image_files"):

            # Check if it's a string instead of a file
            if error["type"] == "value_error" and "Expected UploadFile" in error["msg"]:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "invalid_file_type",
                        "message": "유효하지 않은 파일 형식입니다. 이미지 파일을 업로드해주세요."
                    }
                )

            # Handle other file-related errors
            return JSONResponse(
                status_code=400,
                content={
                    "error": "invalid_file",
                    "message": "이미지 파일 처리 중 오류가 발생했습니다."
                }
            )

    # Default validation error response
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": str(exc),
            "details": errors
        }
    )

app.include_router(curator_routes.router, prefix=f"{settings.API_V1_STR}", tags=["curators"])
app.include_router(banner_routes.router, prefix=f"{settings.API_V1_STR}", tags=["banners"])
app.include_router(terms_routes.router, prefix=f"{settings.API_V1_STR}", tags=["terms"])
app.include_router(notice_routes.router, prefix=f"{settings.API_V1_STR}", tags=["notices"])
app.include_router(auth_routes.router, prefix=f"{settings.API_V1_STR}", tags=["auth"])
app.include_router(user_routes.router, prefix=f"{settings.API_V1_STR}", tags=["users"])
app.include_router(conversation_routes.router, prefix=f"{settings.API_V1_STR}", tags=["conversations"])
app.include_router(token_routes.router, prefix=f"{settings.API_V1_STR}", tags=["tokens"])
app.include_router(notification_routes.router, prefix=f"{settings.API_V1_STR}", tags=["notifications"])
app.include_router(inquiry_routes.router, prefix=f"{settings.API_V1_STR}", tags=["inquiries"])
app.include_router(payment_routes.router, prefix=f"{settings.API_V1_STR}", tags=["payment"])
app.include_router(subscription_routes.router, prefix=f"{settings.API_V1_STR}", tags=["subscription"])
app.include_router(admin_routes.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(footer_routes.router, prefix=f"{settings.API_V1_STR}", tags=["footer"])
app.include_router(exhibition_routes.router, prefix=f"{settings.API_V1_STR}/exhibitions", tags=["exhibitions"])

@app.on_event("startup")
async def startup_event():
    """앱 시작 시 데이터 소스 초기화"""
    try:
        db = next(get_db())
        setup_cultural_data_sources(db)
        logger.info("문화 데이터 소스 초기화 완료")
    except Exception as e:
        logger.error(f"데이터 소스 초기화 실패: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to cul.f API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if settings.DEV_MODE:
    logger.warning("Running in DEVELOPMENT MODE. Authentication is disabled.")
else:
    logger.info("Running in PRODUCTION MODE.")

# API documentation customization
app.title = "cul.f API"
app.description = "API for cul.f service"
app.version = "1.0.0"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)