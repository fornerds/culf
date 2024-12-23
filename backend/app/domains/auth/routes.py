import random
import os
from datetime import timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, FileResponse
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
from starlette.responses import RedirectResponse
from starlette.requests import Request

router = APIRouter()
@router.get("/check-cookies")
def check_cookies(request: Request):
    cookies = request.cookies
    return JSONResponse(content={"cookies": cookies})

@router.post("/auth/register", response_model=user_schemas.UserCreationResponse)
def create_user(request:Request, user: user_schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = user_services.get_user_by_nickname(db, nickname=user.nickname)
    if db_user:
        raise HTTPException(status_code=400, detail={
            "error": "validation_error",
            "message": "입력 정보가 올바르지 않습니다.",
            "details": [{"field": "nickname", "message": "이미 등록된 닉네임입니다."}]
        })
    
    if user.password != user.password_confirmation:
        raise HTTPException(status_code=400, detail={
            "error": "validation_error",
            "message": "입력 정보가 올바르지 않습니다.",
            "details": [{"field": "password_confirmation", "message": "비밀번호와 비밀번호 확인이 일치하지 않습니다."}]
        })
    
    provider_info = request.cookies.get("provider_info")
    if provider_info:
        # Skip email duplication check and password validation
        try:
            email_from_jwt = auth_services.decode_jwt_get_email(provider_info)
            if email_from_jwt != user.email:
                raise HTTPException(status_code=400, detail={
                    "error": "validation_error",
                    "message": "입력 정보가 올바르지 않습니다.",
                            "details": [{"field": "email", "message": "SNS 계정 이메일과 일치하지 않습니다."}]
                })
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider info: {str(e)}"
            )
    else:
        verified_phone_number = request.cookies.get("verified_phone_number")
        if not verified_phone_number or auth_services.encrypt(user.phone_number) != verified_phone_number:
            raise HTTPException(status_code=400, detail={
                "error": "phone_number_verification_failed",
                "message": "전화번호 인증이 필요합니다."
            })
        db_user = user_services.get_user_by_phone_number(db, phone_number=user.phone_number)
        if db_user:
            raise HTTPException(status_code=400, detail={
                "error": "validation_error",
                "message": "입력 정보가 올바르지 않습니다.",
                "details": [{"field": "phone_number", "message": "이미 등록된 번호입니다."}]
            })
        # Perform the regular email duplication check
        db_user = user_services.get_user_by_email(db, email=user.email)
        if db_user:
            detail_message = "사용할 수 없는 이메일입니다." if db_user.status == 'WITHDRAWN' else "이미 등록된 이메일 주소입니다."
            raise HTTPException(status_code=400, detail={
                "error": "validation_error",
                "message": "입력 정보가 올바르지 않습니다.",
                "details": [{"field": "email", "message": detail_message}]
            })
    
    new_user = user_services.create_user(db=db, user=user)
    if provider_info:
        provider_dict = auth_services.decode_jwt(provider_info)
        provider = provider_dict["provider"]
        provider_id = provider_dict["provider_id"]
        user_services.insert_user_provider_info(db, new_user.user_id, provider, provider_id)
    
    access_token, refresh_token = auth_services.create_tokens(str(new_user.user_id))
    response = JSONResponse(
        content={
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "message": "회원가입이 완료되었습니다."
    })
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
    response.delete_cookie("provider_info")
    response.delete_cookie("verification_code")
    response.delete_cookie("verified_phone_number")

    return response

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

@router.post("/auth/login")
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

@router.post("/auth/refresh")
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
    # Delete all cookies
    response = JSONResponse(content={"detail": "Successfully logged out"})
    for cookie in ['refresh_token', 'provider_info', 'verification_code', 'verified_phone_number']:
        response.delete_cookie(cookie)
    return response

@router.post("/auth/find-email")
def find_email(
    phone_number: str = Body(..., embed=True),
    birthdate: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    user = user_services.get_user_by_phone_and_birthdate(db, phone_number=phone_number, birthdate=birthdate)
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": "일치하는 정보가 없습니다."
            }
        )
    
    email = user.email
    masked_email = mask_email(email)
    
    return JSONResponse(content={"email": masked_email})

def mask_email(email: str) -> str:
    user, domain = email.split('@')
    if len(user) > 2:
        masked_user = user[:2] + '*' * (len(user) - 3)
    else:
        masked_user = user
    return f"{masked_user}@{domain}"
\

@router.post("/auth/check-email", response_model=dict)
def check_email(email_check: auth_schemas.EmailCheckRequest, db: Session = Depends(get_db)):
    db_user = user_services.get_user_by_email(db, email=email_check.email)
    if db_user:
        return {"available": False}
    return {"available": True}

@router.post("/auth/phone-verification/request")
def send_verification_code(
    request: Request,
    findpw: bool = Body(default=False, embed=True),
    phone_number: str = Body(..., embed=True), 
    db: Session = Depends(get_db)
):
    #todo 핸드폰 번호 중복확인 임시 조건문 추가
    provider_info = request.cookies.get("provider_info")
    if not provider_info and not findpw:
        user = user_services.get_user_by_phone_number(db, phone_number=phone_number)
        if user:
            raise HTTPException(status_code=400, detail="User already exists with this phone number")
    #todo 핸드폰 번호 중복확인 임시 조건문 추가

    # Generate a random 6-digit verification code
    verification_code = ''.join(random.sample('0123456789', 6))
    encrypted_code = auth_services.encrypt(str(verification_code)+phone_number)  # Ensure you have an encrypt method
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
        response = JSONResponse(content={
            "message": "인증번호가 전송되었습니다.",
            "expiration_time": expires_in
        })
        response.set_cookie(key="verification_code", value=encrypted_code, httponly=True, expires=expires_in)
        return response
    else:
        raise HTTPException(status_code=400, detail={
            "message": "유효하지 않은 휴대폰 번호입니다.",
            "error": "invalid_phone_number"
        })

@router.post("/auth/phone-verification/verify")
def verify_verification_code(
    request: Request,
    verification_code: str = Body(..., embed=True),
    phone_number: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    encrypted_code = request.cookies.get("verification_code")
    if not encrypted_code:
        raise HTTPException(status_code=400, detail={
            "error": "invalid_code",
            "message": "유효하지 않은(만료된) 인증코드입니다.",
            "is_verified": False
        })

    if auth_services.encrypt(verification_code+phone_number) != encrypted_code:
        raise HTTPException(status_code=400, detail={
            "error": "invalid_code",
            "message": "잘못된 인증번호입니다.",
            "is_verified": False
        })

    response = JSONResponse(content={
        "message": "인증이 완료되었습니다.",
        "verified_phone_number":phone_number,
        "is_verified": True
    })
    response.delete_cookie("verification_code")
    response.set_cookie(key="verified_phone_number",value=auth_services.encrypt(phone_number),httponly=True,expires=1200)
    return response

@router.post("/auth/reset-password", response_model=auth_schemas.Msg)
def reset_password(
    request: Request,
    email: str = Body(..., embed=True),
    phone_number: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True),
    new_password_confirm: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    # Verify that the new password and confirmation match
    if new_password != new_password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "validation_error",
                "message": "새 비밀번호와 비밀번호 확인이 일치하지 않습니다."
            }
        )

    # Verify phone number with the cookie value
    verified_phone_number = request.cookies.get("verified_phone_number")
    if not verified_phone_number or auth_services.encrypt(phone_number) != verified_phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "phone_number_verification_failed",
                "message": "전화번호 인증이 필요합니다."
            }
        )

    # Retrieve the user by phone number and verify the email
    user = user_services.get_user_by_phone_number(db, phone_number=phone_number)
    if not user or user.email != email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "validation_error",
                "message": "전화번호와 이메일이 일치하는 사용자를 찾을 수 없습니다."
            }
        )

    # If all checks pass, update the user's password
    user_services.change_user_password(db, user_id=user.user_id, new_password=new_password,new_password_confirm=new_password_confirm)
    
    response = JSONResponse(content={"message": "비밀번호가 성공적으로 변경되었습니다."})
    response.delete_cookie("verification_code")
    response.delete_cookie("verified_phone_number")

    return response

@router.get("/auth/login/{provider}")
def login_with_provider(provider: str, request: Request):
    if provider not in ["google", "kakao"]:  # Add any other supported providers
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported provider",
        )

    # Redirect user to the appropriate OAuth provider's login page
    if provider == "kakao":
        login_url = settings.KAKAO_AUTH_URI  # Kakao OAuth authorize URL
        redirect_uri = settings.KAKAO_REDIRECT_URI  # Your app's redirect URI
        client_id = settings.KAKAO_CLIENT_ID  # Retrieve your Kakao app client ID from settings
        response_type = "code"
        
        # Construct the full URL to redirect the user
        login_url = f"{login_url}?client_id={client_id}&redirect_uri={redirect_uri}&response_type={response_type}"
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)
    elif provider == "google":
        login_url = settings.GOOGLE_AUTH_URI  # Google OAuth authorize URL
        redirect_uri = settings.GOOGLE_REDIRECT_URI  # Your app's Google redirect URI
        client_id = settings.GOOGLE_CLIENT_ID  # Retrieve your Google app client ID from settings
        response_type = "code"
        scope = "email profile"  # Define the scope your app needs

        # Construct the full URL to redirect the user
        login_url = (
            f"{login_url}?client_id={client_id}&redirect_uri={redirect_uri}"
            f"&response_type={response_type}&scope={scope}"
        )
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

@router.get("/auth/callback/google")
async def google_auth_callback(code: str, request: Request, db: Session = Depends(get_db)):
    return await auth_services.process_oauth_callback(
        provider="GOOGLE",
        code=code,
        db=db,
        request=request,
        token_url=settings.GOOGLE_TOKEN_URI,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )

@router.get("/auth/callback/kakao")
async def kakao_auth_callback(code: str, request: Request, db: Session = Depends(get_db)):
    return await auth_services.process_oauth_callback(
        provider="KAKAO",
        code=code,
        db=db,
        request=request,
        token_url=settings.KAKAO_TOKEN_URI,
        redirect_uri=settings.KAKAO_REDIRECT_URI,
        client_id=settings.KAKAO_CLIENT_ID,
        client_secret=settings.KAKAO_CLIENT_SECRET,
    )

@router.get("/auth/provider_email")
def get_provider_email(request: Request):
    provider_info = request.cookies.get("provider_info")
    if not provider_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider info cookie is missing",
        )
    
    try:
        email = auth_services.decode_jwt_get_email(provider_info)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider info: {str(e)}",
        )
    
    return JSONResponse(content={"email": email})

@router.get("/auth/handle_sns_login")
def handle_sns_login(request: Request):
    # Define the path to your HTML file relative to the current file
    current_directory = os.path.dirname(__file__)
    file_path = os.path.join(current_directory, "handle_sns_login_example.html")
    # Return the FileResponse which serves the HTML file
    return FileResponse(path=file_path, media_type='text/html')

@router.get("/auth/sns_login")
def do_sns_login(request: Request):
    # Define the path to your HTML file relative to the current file
    current_directory = os.path.dirname(__file__)
    file_path = os.path.join(current_directory, "sns_login.html")
    # Return the FileResponse which serves the HTML file
    return FileResponse(path=file_path, media_type='text/html')
