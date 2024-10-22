from fastapi import APIRouter, Depends, HTTPException, status, Request
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
from datetime import timedelta
from starlette.responses import RedirectResponse
import httpx

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

@router.get("/login/{provider}")
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
        if provider == "google":
            user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        elif provider == "kakao":
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

@router.get("/auth/callback/google")
async def google_auth_callback(code: str, request: Request):
    user_info = await fetch_token_and_user_info(
        provider="google",
        code=code,
        token_url=settings.GOOGLE_TOKEN_URI,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    
    # Process user_info and return or update user record as needed
    return JSONResponse(content={"user_info": user_info})

@router.get("/auth/callback/kakao")
async def kakao_auth_callback(code: str, request: Request):
    user_info = await fetch_token_and_user_info(
        provider="kakao",
        code=code,
        token_url=settings.KAKAO_TOKEN_URI,
        redirect_uri=settings.KAKAO_REDIRECT_URI,
        client_id=settings.KAKAO_CLIENT_ID,
        client_secret=settings.KAKAO_CLIENT_SECRET
    )
    
    # Process user_info and return or update user record as needed
    
    return JSONResponse(content={"user_info": user_info})
