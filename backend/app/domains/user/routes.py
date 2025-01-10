import random
from fastapi import APIRouter, Body, Depends, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.db.session import get_db
from app.core.deps import get_current_user
from app.domains.auth import services as auth_services
from app.domains.user import schemas as user_schemas
from app.domains.user import services as user_services
from app.domains.token import services as token_services
from app.domains.user.models import User
from uuid import UUID
from app.core.config import settings
from app.utils.sms import AligoService

router = APIRouter()



@router.get("/users")
async def get_users(
        db: Session = Depends(get_db)
):
    """
    전체 사용자 목록을 가져옵니다.
    관리자 페이지에서 사용됩니다.
    """
    query = select(
        User.user_id,
        User.email,
        User.nickname,
        User.phone_number,
        User.gender,
        User.created_at
    ).order_by(User.created_at.desc())

    results = db.execute(query).all()

    users = [
        {
            "user_id": result.user_id,
            "email": result.email,
            "nickname": result.nickname,
            "phone": result.phone_number,
            "gender": result.gender,
            "created_at": result.created_at
        }
        for result in results
    ]

    return {
        "users": users,
        "total_count": len(users)
    }
@router.get("/users/me", response_model=user_schemas.UserInfo)
def read_user_me(current_user: user_schemas.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })

    tokens = token_services.get_user_tokens(db, current_user.user_id)
    response = {
        'user_id': user.user_id,
        'email': user.email,
        'nickname': user.nickname,
        'phone_number': user.phone_number,
        'total_tokens': tokens.total_tokens,
        'created_at': user.created_at,
        'updated_at': user.updated_at,
        'subscription':None
    }
    user_subscription = user_services.get_user_subscription(db, current_user.user_id)
    if user_subscription:
        subscription = {
            'subscription_id':user_subscription.subscription_id,
            'plan_id':user_subscription.plan_id,
            'plan_name':user_subscription.subscription_plan.plan_name,
            'price':user_subscription.subscription_plan.price,
            'next_billing_date':user_subscription.next_billing_date,
            'status':user_subscription.status,
            'subscriptions_method':user_subscription.subscriptions_method
        }
        response['subscription']=subscription
    return response

@router.post("/users/me", response_model=user_schemas.UserInfo)
def read_user_me(current_user: user_schemas.User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })

    tokens = token_services.get_user_tokens(db, current_user.user_id)
    subscription = user_services.get_user_subscription(db, current_user.user_id)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "nickname": user.nickname,
        "phone_number": user.phone_number,
        "total_tokens": tokens.total_tokens,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "subscription": subscription
    }

@router.put("/users/me", response_model=user_schemas.UserUpdateResponse)
def update_user_me(
    user_update: user_schemas.UserUpdate,
    current_user: user_schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })

    """
    회원 정보 수정 API, 전화번호와 닉네임을 수정한다.
    """
    updated_user = user_services.update_user(db, current_user.user_id, user_update)
    return {"message": "회원정보가 수정되었습니다."}

@router.delete("/users/me", response_model=user_schemas.UserDeleteResponse)
def delete_user_me(
    delete_info: user_schemas.UserDelete,
    current_user: user_schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    회원 탈퇴 요청
    """
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })

    user_services.delete_user(db, current_user.user_id, delete_info)
    return {"message": "회원 탈퇴가 완료되었습니다."}

@router.post("/users/me/password", response_model=user_schemas.PasswordChangeResponse)
def confirm_password(
    password_check: user_schemas.PasswordCheck,
    current_user: user_schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user_services.verify_password(plain_password=password_check.current_password, hashed_password=current_user.password):
        raise HTTPException(status_code=400, detail="incorrect_password")
    return {"message": "비밀번호가 확인됐습니다."}

@router.put("/users/me/password", response_model=user_schemas.PasswordChangeResponse)
def change_password(
    request: Request,
    password_change: user_schemas.PasswordChange,
    current_user: user_schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })
    verified_phone_number = request.cookies.get("verified_phone_number_findpw")
    if not verified_phone_number or auth_services.encrypt(user.phone_number) != verified_phone_number:
        raise HTTPException(status_code=400, detail={
            "error": "phone_number_verification_failed",
            "message": "전화번호 인증이 필요합니다."
        })
    user_services.change_user_password(db, current_user.user_id, password_change.new_password, password_change.new_password_confirm)
    response = JSONResponse(content={
        "message": "비밀번호가 성공적으로 변경되었습니다."
    })
    response.delete_cookie("verified_phone_number_findpw")
    return response


@router.post("/users/me/phone-verification/request")
def send_verification_code(
    request: Request,
    phone_number: str = Body(..., embed=True), 
    current_user: user_schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):   
    if current_user.phone_number !=phone_number:
        raise HTTPException(status_code=400, detail={
            "message": "유효하지 않은 휴대폰 번호입니다.",
            "error": "유효하지 않은 휴대폰 번호입니다. 회원정보와 다릅니다."
        })
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
        response.set_cookie(key="verification_code_findpw", value=encrypted_code, httponly=True, expires=expires_in)
        return response
    else:
        raise HTTPException(status_code=400, detail={
            "message": "유효하지 않은 휴대폰 번호입니다.",
            "error": "invalid_phone_number"
        })

@router.post("/users/me/phone-verification/verify")
def verify_verification_code(
    request: Request,
    verification_code: str = Body(..., embed=True), 
    phone_number: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    encrypted_code = request.cookies.get("verification_code_findpw")
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
    response.delete_cookie("verification_code_findpw")
    response.set_cookie(key="verified_phone_number_findpw",value=auth_services.encrypt(phone_number),httponly=True,expires=1200)
    return response

@router.get("/me/tokens", response_model=user_schemas.TokenInfo)
def get_user_tokens(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_user)
):
    user = user_services.get_user(db, user_id=current_user.user_id)
    
    # Check user status
    if user.status == 'WITHDRAWN':
        raise HTTPException(status_code=403, detail={
            "error": "user_withdrawn",
            "message": "탈퇴한 회원입니다."
        })

    user_tokens = token_services.get_user_tokens(db, current_user.user_id)
    return user_schemas.TokenInfo(
        total_tokens=user_tokens.total_tokens,
        used_tokens=user_tokens.used_tokens,
        last_charged_at=user_tokens.last_charged_at
    )

@router.get("/users/check-nickname/{nickname}", response_model=dict)
def check_nickname(nickname: str, db: Session = Depends(get_db)):
    """닉네임 중복 확인 API"""
    db_user = user_services.get_user_by_nickname(db, nickname=nickname)
    return {"exists": db_user is not None}