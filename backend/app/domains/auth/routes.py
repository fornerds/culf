import random
from fastapi import APIRouter, Body, Cookie, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.domains.auth import schemas as auth_schemas
from app.domains.auth import services as auth_services
from app.domains.user import schemas as user_schemas
from app.domains.user import services as user_services
from app.core.security import get_password_hash
from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.utils.sms import AligoService
from datetime import timedelta, datetime

router = APIRouter()


@router.post("/form/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = auth_services.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token, refresh_token = auth_services.create_tokens(str(user.user_id))

    return auth_services.get_json_response(access_token,refresh_token)

@router.post("/login")
def login(
    login_data: auth_schemas.EmailPasswordLogin,
    db: Session = Depends(get_db)
):
    user = auth_services.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status == 'WITHDRAWN':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token, refresh_token = auth_services.create_tokens(str(user.user_id))

    return auth_services.get_json_response(access_token,refresh_token)

@router.post("/register", response_model=user_schemas.User)
def register(user: user_schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = user_services.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return user_services.create_user(db=db, user=user)

@router.post("/refresh")
def refresh_token(request:Request, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    user = auth_services.get_user_from_token(db, refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token, new_refresh_token = auth_services.create_tokens(str(user.user_id))

    return auth_services.get_json_response(access_token,new_refresh_token)

@router.post("/logout")
async def logout():
    # 쿠키에서 Refresh Token 삭제
    response = JSONResponse(content={"detail": "Successfully logged out"})
    response.delete_cookie("refresh_token")
    return response

@router.get("/auth/me", response_model=user_schemas.User)
def read_users_me(current_user: user_schemas.User = Depends(get_current_user)):
    return current_user

@router.put("/auth/me", response_model=user_schemas.User)
def update_user_me(
    user_in: user_schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_user)
):
    return user_services.update_user(db, current_user, user_in)

@router.post("/password-reset", response_model=auth_schemas.Msg)
def reset_password(email: str, db: Session = Depends(get_db)):
    user = user_services.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this email does not exist in the system.",
        )
    # Here you would typically send an email with password reset instructions
    # For this example, we'll just return a success message
    return {"msg": "Password reset email sent"}

@router.post("/auth/check-email", response_model=dict)
def check_email(email_check: auth_schemas.EmailCheckRequest, db: Session = Depends(get_db)):
    db_user = user_services.get_user_by_email(db, email=email_check.email)
    if db_user:
        return {"available": False}
    return {"available": True}

@router.post("/auth/phone-verification/request")
def send_verification_code(
    phone_number: str = Body(..., embed=True), 
    db: Session = Depends(get_db)
):
    user = user_services.get_user_by_phone_number(db, phone_number=phone_number)
    if user:
        raise HTTPException(status_code=400, detail="User already exists with this phone number")

    # Generate a random 6-digit verification code
    verification_code = ''.join(random.sample('0123456789', 6))
    encrypted_code = auth_services.encrypt(str(verification_code))  # Ensure you have an encrypt method
    expires_in = settings.PHONE_NUMBER_VERIFICATION_SECONDS  # Set expiry time
    # Send the SMS using AligoService
    aligo = AligoService()
    response = aligo.send_message(
        receiver=phone_number,
        destination=phone_number + '|테스트',
        msg=f'[컬프] 핸드폰 인증 번호: {verification_code}',
        title='[컬프] 핸드폰 인증 번호'
    )
    if response.get('success'):
        response = JSONResponse(content={"msg": "Verification code sent"})
        response.set_cookie(key="verification_code", value=encrypted_code, httponly=True, expires=expires_in)
        return response
    else:
        raise HTTPException(status_code=500, detail="Failed to send verification code")
