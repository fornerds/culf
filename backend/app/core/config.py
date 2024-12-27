from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from typing import List
import os

# 환경 변수에 따라 적절한 .env 파일 로드
env_file = f".env.{os.environ.get('ENV', 'local')}"
load_dotenv(env_file)

class Settings(BaseSettings):
    PROJECT_NAME: str = "cul.f"
    API_V1_STR: str = "/v1"
    SECRET_KEY: str = "your-secret-key"  # 실제 운영 환경에서는 안전한 비밀 키로 변경해야 합니다
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 8  # 8 days
    ALGORITHM: str = "HS256"

    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: int = os.getenv("DB_PORT")
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    MONGODB_URL: str

    # CloudFront 설정
    CLOUDFRONT_DOMAIN: str
    CLOUDFRONT_DISTRIBUTION_ID: str

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    S3_BUCKET_NAME: str

    OPENAI_API_KEY: str
    OPENAI_ASSISTANT_ID: str
    PERPLEXITY_API_KEY: str

    # 개발 모드 설정 추가
    DEV_MODE: bool = os.getenv("DEV_MODE", "False") == "True"

    CLOUDFRONT_DOMAIN: str
    CLOUDFRONT_DISTRIBUTION_ID: str

    KAKAO_CLIENT_ID: str
    KAKAO_CLIENT_SECRET: str
    KAKAO_AUTH_URI: str
    KAKAO_TOKEN_URI: str
    KAKAO_REDIRECT_URI: str
    KAKAO_REST_API_KEY: str
    
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    PROJECT_ID: str
    GOOGLE_AUTH_URI: str
    GOOGLE_TOKEN_URI: str
    GOOGLE_AUTH_PROVIDER_X509_CERT_URL: str
    GOOGLE_REDIRECT_URI: str
    GOOGLE_JAVASCRIPT_ORIGINS: str

    ALIGO_KEY: str
    ALIGO_USER_ID: str
    ALIGO_SENDER: str
    ALIGO_TESTMODE_YN: str

    PHONE_NUMBER_VERIFICATION_SECONDS: int

    SNS_LOGIN_REDIRECT_URL: str

    USE_GEMINI: bool
    GEMINI_API_KEY: str
    GEMINI_API_URL: str

    KAKAO_PAY_BASE_URL: str
    KAKAO_PAY_CID_ONE: str
    KAKAO_PAY_CID_SUB: str
    KAKAO_PAY_CID_SEQ: str
    KAKAO_PAY_SECRET_KEY: str
    PAYMENT_URL: str
    KAKAO_PAY_SUCCESS: str
    KAKAO_PAY_CANCEL: str
    KAKAO_PAY_FAIL: str

    class Config:
        env_file = ".env"


settings = Settings()