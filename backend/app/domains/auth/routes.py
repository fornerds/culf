from fastapi import APIRouter, Depends, Form, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
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
from starlette.requests import Request
import httpx
import json

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

async def process_oauth_callback(
    provider: str,
    code: str,
    db: Session,
    request: Request,
    token_url: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
    get_email: callable
):
    user_info = await fetch_token_and_user_info(
        provider=provider,
        code=code,
        token_url=token_url,
        redirect_uri=redirect_uri,
        client_id=client_id,
        client_secret=client_secret
    )
    
    email = get_email(user_info)
    provider_id = user_info["id"]
    
    if email:
        db_user = user_services.get_user_by_email(db, email=email)

        if db_user:
            if user_services.is_oauth_account_linked(db_user, provider=provider):
                access_token, refresh_token = auth_services.create_tokens(str(db_user.user_id))
                return auth_services.get_json_response(access_token, refresh_token)
            else:
                return JSONResponse(content={"detail": "Account exists. Please link your accounts."}, status_code=400)
        else:
            # ... within the process_oauth_callback function:
            response = RedirectResponse(url="/v1/register/more-info", status_code=status.HTTP_302_FOUND)
            # Assuming user_info is a dictionary that can be serialized to a JSON string
            response.set_cookie(key="oauth_user_info", value=json.dumps(user_info), httponly=True)
            return response
    else:
        db_user = user_services.get_user_by_provider_id(db, provider=provider, provider_id=provider_id)
        
        if db_user:
            access_token, refresh_token = auth_services.create_tokens(str(db_user.user_id))
            return auth_services.get_json_response(access_token, refresh_token)
        else:
            # ... within the process_oauth_callback function:
            response = RedirectResponse(url="/v1/register/more-info", status_code=status.HTTP_302_FOUND)
            # Assuming user_info is a dictionary that can be serialized to a JSON string
            response.set_cookie(key="oauth_user_info", value=json.dumps(user_info), httponly=True)
        return response

@router.get("/register/more-info", response_class=HTMLResponse)
async def more_info_form(request: Request):
    oauth_user_info = request.cookies.get("oauth_user_info")
    if not oauth_user_info:
        raise HTTPException(status_code=400, detail="Missing OAuth user info")

    user_info = json.loads(oauth_user_info)
    email = user_info.get("email", "")
    
    script_txt = """
                <script>
                async function submitForm(event) {
                    event.preventDefault();
                    const email = document.getElementById('email').value
                    const nickname = document.getElementById('nickname').value;
                    const phoneNumber = document.getElementById('phone_number').value;
                    const birthdate = document.getElementById('birthdate').value;
                    const gender = document.getElementById('gender').value;
                    const marketingAgreed = document.getElementById('marketing_agreed').checked;
                    
                    const data = {
                        email: email,
                        nickname: nickname,
                        phone_number: phoneNumber,
                        birthdate: birthdate,
                        gender: gender,
                        marketing_agreed: marketingAgreed
                    };
                    
                    const response = await fetch('/v1/register/more-info', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await response.json();
                    console.log(result);
                }
            </script>
        """
    # Render a simple form
    form_html = f"""
    <html>
        <body>
            {script_txt}
            <form onsubmit="submitForm(event)">
                <label>Email:</label><br>
                <input type="email" id="email" name="email" value="{email}" {'' if email else 'required'} {'' if not email else 'disabled'} /><br>
                <label>Nickname:</label><br>
                <input type="text" id="nickname" name="nickname" required/><br>
                <label>Phone Number:</label><br>
                <input type="tel" id="phone_number" name="phone_number"/><br>
                <label>Birthdate:</label><br>
                <input type="date" id="birthdate" name="birthdate"/><br>
                <label>Gender:</label><br>
                <select id="gender" name="gender" required>
                    <option value="" disabled selected>Select your gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="N">Other</option>
                </select><br>
                <label>Marketing Agreed:</label><br>
                <input type="checkbox" id="marketing_agreed" name="marketing_agreed" value="true"/><br>
                <input type="submit" value="Submit"/>
            </form>
        </body>
    </html>
    """
    
    return HTMLResponse(content=form_html)

@router.post("/register/more-info")
async def register_more_info(
    request: Request,
    user: user_schemas.OAuthUserCreate,
    db: Session = Depends(get_db)
):
    # SNS 로그인 유저 비밀번호/비밀번호 확인 값 받지 않는 것으로 처리 별도 Schema
    # SNS 가입 유저는 email-password 로그인 불가?

    oauth_user_info = request.cookies.get("oauth_user_info")
    if not oauth_user_info:
        raise HTTPException(status_code=400, detail="Missing OAuth user info")

    user_info = json.loads(oauth_user_info)
    email = user_info.get("email") or user.email
    provider = user_info.get("provider")
    provider_id = user_info.get("id")

    # Ensure the username does not already exist
    existing_user = user_services.get_user_by_nickname(db, user.nickname)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Complete the registration of the new user
    new_user = user_services.create_oauth_user(
        db=db,
        user=user,
        provider=provider,
        provider_id=provider_id,
        email=email
    )
    access_token, refresh_token = auth_services.create_tokens(str(new_user.user_id))
    response = auth_services.get_json_response(access_token, refresh_token)
    response.delete_cookie("oauth_user_info")
    return response

@router.get("/auth/callback/google")
async def google_auth_callback(code: str, request: Request, db: Session = Depends(get_db)):
    return await process_oauth_callback(
        provider="google",
        code=code,
        db=db,
        request=request,
        token_url=settings.GOOGLE_TOKEN_URI,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        get_email=lambda user_info: user_info.get("email")
            )

@router.get("/auth/callback/kakao")
async def kakao_auth_callback(code: str, request: Request, db: Session = Depends(get_db)):
    return await process_oauth_callback(
        provider="kakao",
        code=code,
        db=db,
        request=request,
        token_url=settings.KAKAO_TOKEN_URI,
        redirect_uri=settings.KAKAO_REDIRECT_URI,
        client_id=settings.KAKAO_CLIENT_ID,
        client_secret=settings.KAKAO_CLIENT_SECRET,
        get_email=lambda user_info: user_info.get("kakao_account", {}).get("email")
    )
