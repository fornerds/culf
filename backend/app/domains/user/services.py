from datetime import timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, schemas
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.core.security import get_password_hash, verify_password
from typing import List, Optional, Type
from uuid import UUID
from .models import User
from fastapi import HTTPException
from app.domains.admin.models import SystemSetting
from app.domains.token.models import Token

def get_user(db: Session, user_id: UUID) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.user_id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_nickname(db: Session, nickname: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.nickname == nickname).first()

def get_user_by_phone_number(db: Session, phone_number: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.phone_number == phone_number).first()

def get_user_by_phone_and_birthdate(db: Session, phone_number: str, birthdate: str) -> Optional[models.User]:
    return db.query(models.User).filter(
        models.User.phone_number == phone_number,
        models.User.birthdate == birthdate
    ).first()

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[Type[User]]:
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    db_user = models.User(
        email=user.email,
        password=get_password_hash(user.password) if user.password is not None else None,
        nickname=user.nickname,
        phone_number=user.phone_number,
        birthdate=user.birthdate,
        gender=user.gender,
        marketing_agreed=user.marketing_agreed
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)


    # 가입 축하 스톤 지급 로직
    welcome_tokens_setting = db.query(SystemSetting).filter(
        SystemSetting.key == 'welcome_tokens'
    ).first()

    if welcome_tokens_setting:
        welcome_tokens = int(welcome_tokens_setting.value)
        if welcome_tokens > 0:
            # Token 레코드 생성
            token = Token(
                user_id=db_user.user_id,
                total_tokens=welcome_tokens,
                used_tokens=0,
                last_charged_at=func.now(),
                expires_at=func.now() + timedelta(days=365)  # 1년 후 만료
            )
            db.add(token)
            db.commit()

    return db_user

def update_user(db: Session, user_id: UUID, user_in: schemas.UserUpdate) -> models.User:
    db_user = get_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = user_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: UUID, delete_info: schemas.UserDelete) -> None:
    db_user = get_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.status = 'WITHDRAWN'
    db_user.delete_reason = delete_info.reason
    db_user.deleted_at = func.now()
    # You might want to store the feedback separately
    db.add(db_user)
    db.commit()

def change_user_password(db: Session, user_id: UUID, new_password: str, new_password_confirm: str) -> None:
    db_user = get_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if new_password != new_password_confirm:
        raise HTTPException(status_code=400,detail="New password and confirmation do not match.")
    db_user.password = get_password_hash(new_password)

    db.add(db_user)
    db.commit()

def get_user_subscription(db: Session, user_id: UUID) -> Optional[UserSubscription]:
    return  (db.query(UserSubscription)
            .filter(UserSubscription.user_id == user_id)
            .order_by(UserSubscription.start_date.desc())
            .order_by(UserSubscription.status.asc())
            .first())

def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

def create_corporate_user(db: Session, user: models.User, corporate_info: schemas.CorporateUserCreate) -> models.CorporateUser:
    db_corporate_user = models.CorporateUser(**corporate_info.dict(), user_id=user.user_id)
    db.add(db_corporate_user)
    db.commit()
    db.refresh(db_corporate_user)
    return db_corporate_user

def is_active(user: schemas.User) -> bool:
    return user.status == 'ACTIVE'

def is_superuser(user: schemas.User) -> bool:
    return user.role == 'ADMIN'


def get_user_by_provider_id(db: Session, provider: str, provider_id: str) -> Optional[models.User]:
    return (db.query(models.User)
            .select_from(models.UserProvider)
            .join(models.User, models.UserProvider.user_id == models.User.user_id)
            .filter(
                models.UserProvider.provider == provider.upper(),
                models.UserProvider.provider_id== str(provider_id)
            )
            .first())
#insert user_provider info
def insert_user_provider_info(db: Session, user_id: UUID, provider: str, provider_id: str) -> None:
    user_provider = models.UserProvider(
        user_id=user_id,
        provider=provider,
        provider_id=provider_id
    )
    db.add(user_provider)
    db.commit()

def create_oauth_user(db: Session, user: schemas.OAuthUserCreate, provider: str, provider_id: str, email: str) -> models.User:
    # Create a new user entry
    new_db_user = models.User(
        email=email,
        nickname=user.nickname,
        phone_number=user.phone_number,
        birthdate=user.birthdate,
        gender=user.gender,
        marketing_agreed=user.marketing_agreed
    )

    # Insert user into the database
    db.add(new_db_user)
    db.commit()
    db.refresh(new_db_user)

    # Insert UserProvider info
    insert_user_provider_info(
        user_id=new_db_user.user_id,
        provider=provider,
        provider_id=provider_id
    )

    # Return the newly created user
    return new_db_user

def is_oauth_account_linked(user_id: UUID, provider: str, db: Session) -> bool:
    # Query the database to check if a provider entry exists for this user
    return db.query(models.UserProvider).filter(
        models.UserProvider.user_id == user_id,  # Correctly use user_id directly
        models.UserProvider.provider == provider.upper()  # Ensure the provider is uppercase
    ).first() is not None

# Example usage in the link_oauth_account function
def link_oauth_account(db: Session, user: models.User, provider: str, provider_id: str) -> models.User:
    # Use the newly created method to check if the account is already linked
    # Extract user_id: UUID from the user model
    user_id = UUID(str(user.user_id))

    # Check if the OAuth account is already linked with this provider
    if is_oauth_account_linked(user_id, provider, db):
        raise HTTPException(status_code=400, detail="Account is already linked with this provider.")

    # Link the provider information with the user
    insert_user_provider_info(db, user_id, provider, provider_id)

    # Refresh the user to reflect any updates
    db.refresh(user)

    # Here you would typically generate and return JWT tokens or additional
    # information if needed, adjust the return type and logic accordingly if required.
    
    return user