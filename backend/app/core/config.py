from pydantic_settings import BaseSettings
from dotenv import load_dotenv
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

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    S3_BUCKET_NAME: str

    OPENAI_API_KEY: str
    OPENAI_ASSISTANT_ID: str

    # 개발 모드 설정 추가
    DEV_MODE: bool = os.getenv("DEV_MODE", "False") == "True"

    CLOUDFRONT_DOMAIN: str
    CLOUDFRONT_DISTRIBUTION_ID: str

    class Config:
        env_file = ".env"


settings = Settings()