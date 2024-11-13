from datetime import datetime, timedelta
from typing import Optional, Tuple

import hashlib
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
import httpx
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash, verify_password
from app.domains.auth.schemas import TokenPayload
from app.domains.user.models import User
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
def encrypt(verification_number: str) -> str:
    # One-way encryption using SHA-256
    return hashlib.sha256(verification_number.encode()).hexdigest()

def get_email_from_provider(user_info: dict, provider: str) -> Optional[str]:
    """
    Extracts the email from provider's user information based on the provider name.

    :param user_info: The user information dictionary from the provider.
    :param provider: The name of the provider (e.g., 'kakao').
    :return: The extracted email if available, None otherwise.
    """
    if provider == "kakao":
        return user_info.get("kakao_account", {}).get("email")
    else:
        return user_info.get("email")


def create_jwt_with_provider_info(provider_info: dict) -> str:
    """
    Creates a JWT token containing the user information.

    :param user_info: A dictionary containing user information such as provider, provider_id, and email.
    :return: A JWT token as a string.
    """
    
    # Define the token payload
    payload = {
        "provider": provider_info.get("provider"),
        "provider_id": provider_info.get("provider_id"),
        "email": provider_info.get("email"),
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    
    # Encode the payload into a JWT token
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token

def decode_jwt_get_email(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("email")
    except jwt.JWTError:
        return None

async def fetch_token_and_user_info(
    provider: str, code: str, token_url: str, redirect_uri: str, client_id: str, client_secret: str
):
    token_data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    
    async with httpx.AsyncClient() as client:
        # Request access token
        token_response = await client.post(token_url, data=token_data)
        token_response_data = token_response.json()
        
        if "access_token" not in token_response_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to retrieve access token from {provider}"
            )
        
        access_token = token_response_data["access_token"]
        
        # Determine user info URL and headers based on provider
        if provider == "GOOGLE":
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        elif provider == "KAKAO":
            user_info_url = "https://kapi.kakao.com/v2/user/me"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported provider"
            )

        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_response = await client.get(user_info_url, headers=headers)
        user_info = user_info_response.json()
        if user_info_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to retrieve user info from {provider}"
            )
    return user_info

async def process_oauth_callback(
    provider: str,
    code: str,
    db: Session,
    request: Request,
    token_url: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str
):
    user_info = await fetch_token_and_user_info(
        provider=provider,
        code=code,
        token_url=token_url,
        redirect_uri=redirect_uri,
        client_id=client_id,
        client_secret=client_secret
    )
    
    # Extract the necessary information from user_info
    # Example usage: 
    email = get_email_from_provider(user_info, provider=provider)
    provider_id = user_info["id"]
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    # Check if there's a linked account using the provider and provider_id
    db_user = user_services.get_user_by_provider_id(db, provider=provider, provider_id=provider_id)
    if db_user:
        # If linked account exists, generate JWT and respond
        access_token, refresh_token = create_tokens(str(db_user.user_id))
        # Return a 307 Temporary Redirect HTTP Response with cookie settings
        response = JSONResponse(
            headers={"Location": settings.SNS_LOGIN_REDIRECT_URL},  # Redirect URL from settings
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            content={"OAUTH_LOGIN_STATUS":"success"}
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,  # 자바스크립트에서 접근 불가
            max_age=refresh_token_expires.total_seconds(),  # 쿠키 만료 시간 설정
            expires=refresh_token_expires.total_seconds(),
            secure=False,  # HTTPS에서만 전송 (개발 중에는 False로 설정 가능)
            samesite="lax",  # 쿠키의 SameSite 속성
        )
        response.set_cookie(
            key="OAUTH_LOGIN_STATUS",
            value="success",  # Use a descriptive value for clarity
            httponly=False,   # Allow the cookie to be accessible via client-side scripts
            max_age=3600,     # Set an appropriate expiration time for the session
            secure=False,      # Ensure it's transmitted only over HTTPS in production
            samesite="Lax"    # Consider setting `SameSite` to align with security best practices
        )   
        return response
    else:
        provider_info={
            "provider": provider,
            "provider_id": provider_id,
            "email": email
        }
        # First time login with this provider_id
        if email:
            db_user = user_services.get_user_by_email(db, email=email)

            if db_user:
                # If existing account is found by email, link it automatically
                user_services.link_oauth_account(db=db,user=db_user, provider=provider, provider_id=provider_id)
                access_token, refresh_token = create_tokens(str(db_user.user_id))
                # Return a 307 Temporary Redirect HTTP Response with cookie settings
                response = JSONResponse(
                    headers={"Location": settings.SNS_LOGIN_REDIRECT_URL},  # Redirect URL from settings
                    status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                    content={"OAUTH_LOGIN_STATUS":"success"}
                )
                response.set_cookie(
                    key="refresh_token",
                    value=refresh_token,
                    httponly=True,  # 자바스크립트에서 접근 불가
                    max_age=refresh_token_expires.total_seconds(),  # 쿠키 만료 시간 설정
                    expires=refresh_token_expires.total_seconds(),
                    secure=False,  # HTTPS에서만 전송 (개발 중에는 False로 설정 가능)
                    samesite="lax",  # 쿠키의 SameSite 속성
                )
                response.set_cookie(
                    key="OAUTH_LOGIN_STATUS",
                    value="success",  # Use a descriptive value for clarity
                    httponly=False,   # Allow the cookie to be accessible via client-side scripts
                    max_age=3600,     # Set an appropriate expiration time for the session
                    secure=False,      # Ensure it's transmitted only over HTTPS in production
                    samesite="Lax"    # Consider setting `SameSite` to align with security best practices
                )
                return response
            else:
                # If no existing account, respond with a redirect and include OAuth user info in the JWT token
                jwt_token = create_jwt_with_provider_info(provider_info)
                response = JSONResponse(headers={"Location": settings.SNS_LOGIN_REDIRECT_URL}, status_code=status.HTTP_307_TEMPORARY_REDIRECT, content={"oauth_login_status":"continue"})
                response.set_cookie(key="provider_info", value=jwt_token)
                response.set_cookie(
                    key="OAUTH_LOGIN_STATUS",
                    value="continue",  # Use a descriptive value for clarity
                    httponly=False,   # Allow the cookie to be accessible via client-side scripts
                    max_age=3600,     # Set an appropriate expiration time for the session
                    secure=False,      # Ensure it's transmitted only over HTTPS in production
                    samesite="Lax"    # Consider setting `SameSite` to align with security best practices
                )
                return response
        else:
            # No email provided, package user info in JWT and suggest additional info entry with a redirect
            jwt_token = create_jwt_with_provider_info(provider_info)
            response = JSONResponse(headers={"Location": settings.SNS_LOGIN_REDIRECT_URL}, status_code=status.HTTP_307_TEMPORARY_REDIRECT, content={"oauth_login_status":"continue"})
            response.set_cookie(key="provider_info", value=jwt_token)
            response.set_cookie(
                key="OAUTH_LOGIN_STATUS",
                value="continue",  # Use a descriptive value for clarity
                httponly=False,   # Allow the cookie to be accessible via client-side scripts
                max_age=3600,     # Set an appropriate expiration time for the session
                secure=False,      # Ensure it's transmitted only over HTTPS in production
                samesite="Lax"    # Consider setting `SameSite` to align with security best practices
            )
            return response