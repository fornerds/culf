from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
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
    - 토큰 관리
    - 알림 관리
    - 관리자 기능
    """,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
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