import random
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.domains.user import services, schemas as user_schemas
from app.domains.user import services as user_services
from app.domains.user.models import User
import logging
from datetime import datetime, date
import uuid

oauth2_scheme = OAuth2PasswordBearer(
   tokenUrl=f"{settings.API_V1_STR}/form/login",
   scheme_name="Email & Password",
   description="Use your email and password to login",
   auto_error=False
)

async def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> user_schemas.User:
    if settings.DEV_MODE:
        logging.warning("Using dev mode authentication")
        dev_user = user_services.get_user_by_email(db, email="culftester@culf.com")

        if not dev_user:
            # 만약 culftester가 없다면 생성
            dev_user_id = uuid.UUID('1e01b80f-95e8-4e6c-8dd7-9ce9a94ceda2')
            dev_user = user_services.create_user(db, user_schemas.UserCreate(
                user_id=dev_user_id,
                email="culftester@culf.com",
                password="devpassword",
                password_confirmation="devpassword",
                nickname="culftestnick",
                birthdate=date(1990, 1, 1),
                gender="M",
                phone_number="01045678901",
                marketing_agreed=True
            ))
            dev_user.role = 'ADMIN'
            db.commit()
        return dev_user

    # 실제 운영 환경의 인증 로직
    if not token:
        return None  # 토큰이 없으면 None 반환

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = services.get_user(db, user_id=user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_active_user(
    current_user: user_schemas.User = Depends(get_current_user),
) -> user_schemas.User:
    if not services.is_active(current_user):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if settings.DEV_MODE:
        logging.warning("Using dev mode authentication for superuser")
        return current_user
    if not user_services.is_superuser(current_user):
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return current_user

def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """관리자 권한 확인"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    return current_user