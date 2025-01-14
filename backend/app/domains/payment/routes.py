from fastapi import APIRouter, Depends, HTTPException, Query, status, Form, File, UploadFile, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import datetime
import logging
from uuid import UUID
import uuid

from app.domains.user.models import User
from app.domains.user import schemas as user_schemas
from app.domains.payment import schemas, services, portone_services
from app.domains.payment.services import PaymentService
from app.domains.inquiry import schemas as inquiry_schemas
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
        "subscription_plans": [schemas.SubscriptionPlanSchema.from_orm(plan) for plan in
                               products["subscription_plans"]],
        "token_plans": [schemas.TokenPlanSchema.from_orm(plan) for plan in products["token_plans"]]
    }


@router.get("/payments/products/{product_id}",
            response_model=Union[schemas.SubscriptionPlanSchema, schemas.TokenPlanSchema])
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

        payment_data = payment_service.initiate_payment(payment_request=payment_request, db=db,
                                                        current_user=current_user)
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
        partner_order_id: str,
        db: Session = Depends(get_db)
):
    logger.info(f"Received partner_order_id: {partner_order_id}")
    try:
        payment_service.approve_payment(pg_token, db, partner_order_id)
        redirect_url = f"{settings.PAYMENT_URL}?success"
        logger.info(f"Redirecting to success URL: {redirect_url}")
        return RedirectResponse(url=redirect_url)

    except HTTPException as http_err:
        logger.error(f"HTTPException during payment approval: {http_err}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason={http_err.detail}"
        logger.error(f"Redirecting to failure URL: {redirect_url}")
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        logger.error(f"Unexpected error during payment approval: {e}")
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason={str(e)}"
        logger.error(f"Redirecting to unknown error URL: {redirect_url}")
        return RedirectResponse(url=redirect_url)


@router.get("/pay/fail")
async def payment_fail(
        partner_order_id: str,
        error_code: Optional[int] = None,
        error_message: Optional[str] = None,
        method_result_code: Optional[str] = None,
        method_result_message: Optional[str] = None,
        db: Session = Depends(get_db)
):
    logger.info(f"Received partner_order_id: {partner_order_id}")
    try:
        response_data = {
            "error_code": error_code,
            "error_message": error_message,
            "extras": {
                "method_result_code": method_result_code,
                "method_result_message": method_result_message,
            },
        }
        payment_service.fail_payment(response_data, db, partner_order_id=partner_order_id)
        redirect_url = f"{settings.PAYMENT_URL}?fail&reason={response_data.get('error_message', 'unknown_error')}"
        logger.info(f"Redirecting to failure URL: {redirect_url}")
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
        raise HTTPException(status_code=500,
                            detail="An unexpected error occurred during automatic subscription processing.")


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


# admin 관련 엔드 포인트
@router.get("/admin/payments", response_model=List[schemas.PaymentListResponse])
async def get_admin_payments(
    query: Optional[str] = Query(None, description="검색어 (결제번호, 닉네임)"),
    payment_method: Optional[str] = Query(None, description="결제 수단 (manual, kakaopay)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
    sort: str = Query("payment_date:desc", description="정렬 (field:asc|desc)"),
    status: Optional[str] = Query(None, description="결제 상태"),
    db: Session = Depends(get_db)
):
    """
    결제 내역 조회 API
    - payment_method: 결제 수단으로 필터링 (manual: 수동결제, kakaopay: 카카오페이)
    - query: 결제번호, 닉네임으로 검색
    - start_date, end_date: 결제일 기간 필터링
    - sort: 정렬 기준 (예: payment_date:desc)
    - status: 결제 상태로 필터링
    """
    payments, total_count = services.get_admin_payments(
        db=db,
        query=query,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
        sort=sort,
        status=status
    )

    return JSONResponse(
        content=jsonable_encoder(payments),
        headers={"X-Total-Count": str(total_count)}
    )

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
        refund = PaymentService.process_refund(refund_id=refund_id, db=db)
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


# 포트원 결제 API
@router.post("/portone/payment")
async def one_time_payment(
        payment_request: schemas.OneTimePaymentRequest,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """단건 결제 요청"""
    result = portone_services.initiate_one_time_payment(payment_request, db, current_user)
    return result


@router.post("/portone/subscription")
async def subscription_payment(
        subscription_request: schemas.SubscriptionPaymentRequest,
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user)
):
    """구독 결제 요청"""
    result = portone_services.initiate_subscription_payment(subscription_request, db, current_user)
    return result


@router.post("/payment-complete")
async def payment_complete(
        payment_request: schemas.PaymentCompleteRequest,
        db: Session = Depends(get_db),
):
    """결제 완료 검증 및 처리"""
    result = portone_services.verify_and_save_payment(payment_request, db)
    return result


@router.post("/portone/cancel")
def cancel_payment(
        inquiry_id: int,
        db: Session = Depends(get_db)
):
    """결제 환불 요청 및 처리"""
    try:
        result = portone_services.issue_refund(inquiry_id=inquiry_id, db=db)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")


@router.post("/import/webhook")
async def import_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        # 요청 데이터 읽기
        body = await request.json()
        imp_uid = body.get("imp_uid")
        merchant_uid = body.get("merchant_uid")
        status = body.get("status")
        customer_uid = body.get("customer_uid", None)  # 정기 결제의 경우 포함

        if not imp_uid or not merchant_uid:
            raise HTTPException(status_code=400, detail="유효하지 않은 웹훅 요청입니다.")

        # 결제 정보 조회
        payment_info = portone_services.get_portone_payment_info(imp_uid)
        payment_type = portone_services.identify_payment_type(merchant_uid)  # 주문 ID를 기반으로 유형 식별

        if payment_type == "subscription":
            # 정기 결제 처리
            portone_services.process_subscription_payment(payment_info, db)
        elif payment_type == "single":
            # 일회성 결제 처리
            portone_services.process_single_payment(payment_info, db)
        else:
            raise HTTPException(status_code=400, detail="알 수 없는 결제 유형입니다.")

        return {"status": "success", "message": "웹훅 처리 완료"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"웹훅 처리 중 오류: {str(e)}")

