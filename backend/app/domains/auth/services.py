from datetime import datetime, timedelta
from fastapi.responses import JSONResponse
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.domains.user.models import User
from app.core.security import create_access_token, create_refresh_token, verify_password, get_password_hash
from app.domains.auth.schemas import TokenPayload
from jose import jwt
from app.core.config import settings
from app.domains.user import services as user_services
from app.domains.user import schemas as user_schemas

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = user_services.get_user_by_email(db, email)
    if not user or not verify_password(password, user.password):
        return None
    return user

def create_tokens(user_id: str) -> Tuple[str, str]:
    access_token = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)
    return access_token, refresh_token

def get_user_from_token(db: Session, token: str) -> Optional[User]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
    except jwt.JWTError:
        return None
    if datetime.fromtimestamp(token_data.exp) < datetime.now():
        return None
    user = user_services.get_user(db, user_id=token_data.sub)
    return user

def find_email(db: Session, phone_number: str, birthdate: str) -> Optional[str]:
    user = user_services.get_user_by_phone_and_birthdate(db, phone_number, birthdate)
    if user:
        return user.email[:2] + "*" * (len(user.email) - 5) + user.email[-3:]
    return None

def request_phone_verification(phone_number: str) -> Tuple[bool, str]:
    # Here you would implement the logic to send a verification code
    # For this example, we'll just return a dummy success response
    return True, "Verification code sent successfully"

def verify_phone(phone_number: str, verification_code: str) -> bool:
    # Here you would implement the logic to verify the code
    # For this example, we'll just return a dummy success response
    return True

def reset_password(db: Session, email: str, new_password: str) -> bool:
    user = user_services.get_user_by_email(db, email)
    if not user:
        return False
    password = get_password_hash(new_password)
    user.password = password
    db.commit()
    return True

def get_json_response(access_token :str,refresh_token :str,) -> JSONResponse:
    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer","expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES})
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        # 쿠키에 Refresh Token을 설정 (httpOnly, secure 옵션 추가 가능)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,  # 자바스크립트에서 접근 불가
        max_age=refresh_token_expires.total_seconds(),  # 쿠키 만료 시간 설정
        expires=refresh_token_expires.total_seconds(),
        secure=False,  # HTTPS에서만 전송 (개발 중에는 False로 설정 가능)
        samesite="lax",  # 쿠키의 SameSite 속성
    )
    return response

def get_oauth_user_info(provider: str, token: str) -> Optional[dict]:
    import requests

    if provider == "kakao":
        url = "https://kapi.kakao.com/v2/user/me"
        headers = {"Authorization": f"Bearer {token}"}
    elif provider == "google":
        url = "https://www.googleapis.com/oauth2/v2/userinfo"
        headers = {"Authorization": f"Bearer {token}"}
    else:
        return None

    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    return None
