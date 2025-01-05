from fastapi import APIRouter, Depends, HTTPException, Query, status, Form, File, UploadFile, Request
from fastapi.responses import RedirectResponse
from pydantic import ValidationError
import requests
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import datetime
import logging
from uuid import UUID
import uuid

from app.domains.user.models import User
from app.domains.user import schemas as user_schemas
from app.domains.payment import schemas, services
from app.domains.payment.services import PaymentService
from app.domains.inquiry import schemas as inquiry_schemas
from app.domains.payment.portone_services import PortoneServices
from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.core.config import settings
from app.utils.s3_client import upload_file_to_s3
from app.utils.cloudfront_utils import get_cloudfront_url

logger = logging.getLogger("app")

router = APIRouter()

# 상품 관련 엔드포인트
@router.get("/payments/products", response_model=dict)
async def get_all_products(db: Session = Depends(get_db)):
    products = services.get_all_products(db)
    return {
        "subscription_plans": [schemas.SubscriptionPlanSchema.from_orm(plan) for plan in products["subscription_plans"]],
        "token_plans": [schemas.TokenPlanSchema.from_orm(plan) for plan in products["token_plans"]]
    }

@router.get("/payments/products/{product_id}", response_model=Union[schemas.SubscriptionPlanSchema, schemas.TokenPlanSchema])
async def get_product_by_id(product_id: int, product_type: str, db: Session = Depends(get_db)):
    product = services.get_product_by_id(db, product_id, product_type)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_type == "subscription":
        return schemas.SubscriptionPlanSchema.from_orm(product)
    elif product_type == "token":
        return schemas.TokenPlanSchema.from_orm(product)

# 개인 결제 내역 조회 API
@router.get("/users/me/payments", response_model=List[schemas.PaymentResponse])
async def get_me_payments(
    page: int = 1,
    limit: int = 10,
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payments = services.get_me_payments(db, user_id, page, limit, year, month)
    return payments

@router.get("/users/me/payments/{payment_id}", response_model=schemas.PaymentResponse)
async def get_payment_detail(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    user_id = current_user.user_id
    payment = services.get_payment_detail(db, payment_id, user_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/users/me/payments/{payment_id}/cancel", response_model=schemas.PaycancelResponse)
async def cancel_payment(
    payment_id: UUID,
    title: str = Form(..., description="문의 제목"),
    email: str = Form(..., description="연락받을 이메일"),
    contact: str = Form(..., description="연락처"),
    content: str = Form(..., description="문의 내용"),
    attachments: List[UploadFile] = File(None, description="첨부파일 (선택)"),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user),
):
    try:
        # 첨부파일 처리
        attachment_info = []
        if attachments:
            for file in attachments:
                file_extension = file.filename.split('.')[-1]
                object_name = f"inquiries/{uuid.uuid4()}.{file_extension}"

                if upload_file_to_s3(file.file, settings.S3_BUCKET_NAME, object_name):
                    image_url = get_cloudfront_url(object_name)
                    attachment_info.append({
                        "file_name": file.filename,
                        "file_type": file.content_type,
                        "file_url": image_url
                    })

        # 문의사항 데이터 생성
        inquiry_data = inquiry_schemas.InquiryCreate(
            title=title,
            email=email,
            contact=contact,
            content=content,
            attachments={"files": attachment_info} if attachment_info else None,
        )

        # 결제 취소 및 문의 생성
        result = services.cancel_payment_with_inquiry(db, payment_id, current_user.user_id, inquiry_data)
        if not result:
            raise HTTPException(status_code=404, detail="Payment not found.")

        return {
            "inquiry_id": result["inquiry"].inquiry_id,
            "refund_id": result["refund"].refund_id,
            "payment_number": str(payment_id),
            "status": "CANCELLATION_REQUESTED",
            "message": "환불 요청과 문의가 성공적으로 접수되었습니다.",
        }

    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "validation_error",
                "message": str(ve),
            }
        )
    except Exception as e:
        logging.error(f"Payment cancellation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "payment_cancellation_failed",
                "message": "결제 취소 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
            }
        )

# 쿠폰 유효성 검사
@router.post("/payments/coupons/validate", response_model=schemas.CouponValidationResponse)
def validate_coupon(
    coupon_data: schemas.CouponValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    validation_response = services.validate_coupon(db, coupon_data.coupon_code, current_user.user_id)
    return validation_response

# 결제 관련 엔드포인트
@router.post("/payments", response_model=schemas.PaymentResponse)
def create_payment(payment_data: schemas.PaymentCreate, db: Session = Depends(get_db)):
    payment = services.create_payment(db, payment_data)
    return payment

payment_service = PaymentService()

@router.post("/pay")
async def initiate_payment(
    payment_request: schemas.KakaoPayRequest,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        logger.info(f"User: {current_user}")
        logger.info(f"Received payment request: {payment_request}")
        logger.info(f"Environment: {payment_request.environment}")

        payment_data = payment_service.initiate_payment(payment_request=payment_request, db=db, current_user=current_user)
        return payment_data
    except HTTPException as e:
        logger.error(f"HTTP Exception: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error initiating payment: {str(e)}")
        raise HTTPException(status_code=400, detail="결제 준비에 실패했습니다.")

@router.get("/pay/success")
async def approve_payment(
    pg_token: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    try:
        payment_approval = payment_service.approve_payment(pg_token, db, current_user.user_id)
        redirect_url = f"{settings.PAYMENT_URL}?success"
        return RedirectResponse(url=redirect_url)
    except HTTPException as http_err:
        logger.error(f"HTTPException during payment approval: {http_err}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason={http_err.detail}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Unexpected error during payment approval: {e}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason=unknown_error"
        return RedirectResponse(url=redirect_url)

@router.get("/pay/fail")
async def payment_fail(
    error_code: Optional[int] = None,
    error_message: Optional[str] = None,
    method_result_code: Optional[str] = None,
    method_result_message: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        # 실패 응답 데이터 구성
        response_data = {
            "error_code": error_code,
            "error_message": error_message,
            "extras": {
                "method_result_code": method_result_code,
                "method_result_message": method_result_message,
            },
        }

        # 실패 처리 서비스 호출
        failure_data = payment_service.fail_payment(response_data, db)

        # 리다이렉션 URL 생성
        redirect_url = (
            f"{settings.PAYMENT_URL}?fail"
            f"&reason={failure_data['reason']}"
            f"&details={failure_data['details']}"
            f"&payment_id={failure_data['payment_id']}"
        )
        return RedirectResponse(url=redirect_url)

    except HTTPException as http_err:
        logger.error(f"HTTPException during payment failure: {http_err}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason={http_err.detail}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        logger.error(f"Unexpected error during payment failure: {e}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason=unknown_error"
        return RedirectResponse(url=redirect_url)

@router.get("/pay/cancel")
async def payment_cancel():
    redirect_url = f"{settings.PAYMENT_URL}"
    return RedirectResponse(url=redirect_url)

@router.post("/subscription")
async def initiate_subscription(
    subscription_request: schemas.KakaoPaySubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        subscription_data = payment_service.initiate_subscription(subscription_request, db, current_user)
        return subscription_data
    except HTTPException as e:
        logger.error(f"HTTP Exception: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error initiating payment: {str(e)}")
        raise HTTPException(status_code=400, detail="결제 준비에 실패했습니다.")

@router.post("/subscription/pay/{user_id}")
async def pay_subscription_for_user(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        result = PaymentService.process_subscription(user_id, db)
        return result
    except HTTPException as e:
        logger.error(f"Error processing subscription for user_id {user_id}: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error processing subscription for user_id {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during subscription processing.")

@router.post("/subscriptions/automatic")
async def automatic_subscription_payments(
    db: Session = Depends(get_db),
):
    try:
        results = PaymentService.process_all_subscriptions(db)
        return results
    except HTTPException as e:
        logger.error(f"Error processing automatic subscriptions: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during automatic subscription processing: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during automatic subscription processing.")

@router.post("/subscription/cancel")
async def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        cancellation_response = payment_service.cancel_subscription(current_user.user_id, db)
        return cancellation_response
    except HTTPException as e:
        logger.error(f"Subscription cancellation failed: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during subscription cancellation: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during subscription cancellation.")

@router.get("/subscription/status")
async def subscription_status(
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    try:
        status_response = payment_service.get_subscription_status(current_user.user_id, db)
        return status_response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subscription/change-method")
async def change_subscription_method(
    subscription_request: schemas.KakaoPaySubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user),
):
    try:
        payment_service = PaymentService()
        response = payment_service.change_subscription_method(
            user_id=current_user.user_id,
            subscription_request=subscription_request,
            db=db,
        )
        return {"message": "Subscription payment method changed successfully.", "data": response}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#admin 관련 엔드 포인트
@router.get("/admin/payments", response_model=List[schemas.PaymentListResponse])
def get_admin_payments(
    query: Optional[str] = Query(None, description="검색어 (결제 ID, 닉네임, 상품명, 결제 수단)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    page: int = Query(1, description="페이지 번호"),
    limit: int = Query(10, description="페이지당 항목 수"),
    sort: str = Query("payment_date:desc", description="정렬 기준 (예: payment_date:desc)"),
    db: Session = Depends(get_db)
):
    """
    검색 및 필터링된 결제 내역 조회 API
    """
    payments = services.get_admin_payments(
        db=db,
        query=query,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
        sort=sort
    )
    return payments

@router.get("/admin/payments/{payment_id}", response_model=schemas.PaymentDetailResponse)
def get_payment_detail(payment_id: UUID, db: Session = Depends(get_db)):
    """
    단일 결제 상세 조회 API
    - 결제 내역, 환불 내역, 문의 내역을 포함하여 반환
    """
    payment = services.get_payment_detail(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.post("/admin/payments", response_model=schemas.PaymentAdminResponse)
def create_manual_payment_route(payment: schemas.AdminPaymentCreate, db: Session = Depends(get_db)):
    if not payment.subscription_id and not payment.token_plan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'subscription_id' or 'token_plan_id' must be provided."
        )

    new_payment = services.create_manual_payment(db, payment.dict())
    return new_payment

@router.post("/admin/refunds/{refund_id}", response_model=schemas.AdminRefundResponse)
def admin_process_refund(refund_id: int, db: Session = Depends(get_db)):
    """
    환불 요청 승인 및 처리
    """
    try:
        refund = services.process_refund(refund_id=refund_id, db=db)
        return refund
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unexpected error occurred.")

# 쿠폰 관련 엔드포인트
@router.post("/admin/coupons", response_model=schemas.CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(coupon_data: schemas.CouponCreate, db: Session = Depends(get_db)):
    return services.create_coupon(db, coupon_data)

@router.put("/admin/coupons/{coupon_id}", response_model=schemas.CouponResponse)
def update_coupon(coupon_id: int, coupon_data: schemas.CouponUpdate, db: Session = Depends(get_db)):
    return services.update_coupon(db, coupon_id, coupon_data)

@router.delete("/admin/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coupon(coupon_id: int, db: Session = Depends(get_db)):
    services.delete_coupon(db, coupon_id)
    return {"message": "Coupon deleted successfully"}

@router.get("/admin/coupons/{coupon_id}", response_model=schemas.CouponResponse)
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
    return services.get_coupon(db, coupon_id)

portone_service = PortoneServices()

PORTONE_API_URL = "https://api.iamport.kr"
IMP_KEY = "9566775633856234"
IMP_SECRET = "u1c8W8sUK9wrT58fqYL5f5wvJumJMCQhE3pAcSvW21oV6wbxuWCJ28fLDBvqemHSp7tB0Yx2ZVY6r9DW"
DANAL_BIZ_NUM=1234567890
CHANNEL_KEYS = {
    "kakaopay": "channel-key-44ca60ca-2d36-434c-835b-80b8adcb7792",
    "kakaopay_sub": "channel-key-6c1c4c76-8d36-431f-92f2-9630a9592e35",
    "danal_tpay": "channel-key-5eea97cd-86a3-46ee-8355-206cb1e7c996",
    "danal": "channel-key-1f4f188f-dcb6-42d4-b023-6e7cb9a8c656",
}

@router.post("/one-time")
async def one_time_payment(
    payment_request: schemas.OneTimePaymentRequest,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """단건 결제 요청"""
    result = portone_service.initiate_one_time_payment(payment_request, db, current_user)
    return result

@router.post("/subscription")
async def subscription_payment(
    subscription_request: schemas.SubscriptionPaymentRequest,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user)
):
    """구독 결제 요청"""
    result = portone_service.initiate_subscription_payment(subscription_request, db, current_user)
    return result

@router.post("/payment-complete")
async def payment_complete(
    payment_request: schemas.PaymentCompleteRequest,
    db: Session = Depends(get_db),
):
    """결제 완료 검증 및 처리"""
    result = portone_service.verify_and_save_payment(payment_request, db)
    return result