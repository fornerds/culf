from sqlalchemy import func
from sqlalchemy.orm import Session
from . import models, schemas
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.core.security import get_password_hash, verify_password
from typing import List, Optional, Type
from uuid import UUID
from .models import User
from fastapi import HTTPException

def get_user(db: Session, user_id: UUID) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.user_id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_nickname(db: Session, nickname: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.nickname == nickname).first()

def get_user_by_phone_number(db: Session, phone_number: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.phone_number == phone_number).first()

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
    db_user.hashed_password = get_password_hash(new_password)

    db.add(db_user)
    db.commit()

def get_user_subscription(db: Session, user_id: UUID) -> Optional[UserSubscription]:
    return  (db.query(UserSubscription)
            .filter(UserSubscription.user_id == user_id)
            .order_by(UserSubscription.start_date.desc())
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


def get_user_by_provider_id(db: Session, provider: str, provider_id: str) -> Optional[User]:
    return db.query(User).filter(User.provider == provider, User.provider_id == str(provider_id)).first()

def create_oauth_user(db: Session, user: schemas.OAuthUserCreate, provider: str, provider_id: str, email: str) -> models.User:
    new_db_user = models.User(
        email=email,
        provider=provider,
        provider_id=str(provider_id),
        nickname=user.nickname,
        phone_number=user.phone_number,
        birthdate=user.birthdate,
        gender=user.gender,
        marketing_agreed=user.marketing_agreed
    )
    return create_user(db=db, user=new_db_user)

def is_oauth_account_linked(db_user: models.User, provider: str) -> bool:
    return db_user.provider == provider and db_user.provider_id is not None
