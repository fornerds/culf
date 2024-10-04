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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> user_schemas.User:
    if settings.DEV_MODE:
        logging.warning("Using dev mode authentication")
        dev_email = "dev@example.com"
        dev_user = services.get_user_by_email(db, email=dev_email)
        if not dev_user:
            dev_user = user_services.create_user(db, user_schemas.UserCreate(
                email=dev_email,
                password="devpassword",
                password_confirmation="devpassword",
                nickname="DevAdmin",
                birthdate=date(1990, 1, 1),
                gender="N",
                phone_number="1234567890",
                marketing_agreed=False
            ))
            dev_user.role = 'ADMIN'
            db.commit()
        return dev_user

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token has expired")
    except JWTError:
        raise credentials_exception
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