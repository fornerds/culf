from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.domains.user.models import User
from app.core.security import create_access_token, create_refresh_token, verify_password, get_password_hash
from app.domains.auth.schemas import TokenPayload
from jose import jwt
from app.core.config import settings
from app.domains.user import services as user_services

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = user_services.get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
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
    hashed_password = get_password_hash(new_password)
    user.hashed_password = hashed_password
    db.commit()
    return True