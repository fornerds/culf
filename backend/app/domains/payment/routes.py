from fastapi import APIRouter, Depends, HTTPException, Query, status, Form, File, UploadFile, Request
from fastapi.responses import RedirectResponse
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import datetime
import logging
from uuid import UUID
import json

from app.domains.user.models import User
from app.domains.user import schemas as user_schemas
from app.domains.inquiry import services as inquiry_services
from app.domains.payment.models import Payment
from app.domains.payment import schemas, services, portone_services
from app.domains.subscription import models as subscriprion_models
from app.db.session import get_db
from app.core.deps import get_current_active_user, get_current_admin_user
from app.core.config import settings

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
        payment_id: UUID,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_active_user)
):
    payment = services.get_payment_detail(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/users/me/payments/{payment_id}/cancel", response_model=schemas.PaycancelResponse)
async def cancel_payment(
        payment_id: UUID,
        title: str = Form(...),
        email: str = Form(...),
        contact: str = Form(...),
        content: str = Form(...),
        attachments: List[UploadFile] = File(None),
        db: Session = Depends(get_db),
        current_user: user_schemas.User = Depends(get_current_active_user),
):
    """결제 취소 및 문의 사항 생성 API"""
    try:
        # 첨부파일 처리
        attachment_urls = inquiry_services.process_attachments(attachments)

        # 결제 정보 확인
        payment = db.query(Payment).filter(
            Payment.payment_id == payment_id,
            Payment.user_id == current_user.user_id
        ).first()
        if not payment:
            logging.error("Payment not found")
            raise HTTPException(status_code=404, detail="Payment not found.")

        # 문의사항 데이터 생성
        inquiry_data = {
            "title": title,
            "email": email,
            "contact": contact,
            "content": content,
            "attachments": attachment_urls if attachment_urls else None
        }

        # 문의사항 저장
        inquiry = inquiry_services.create_inquiry(db, inquiry_data)

        # 환불 데이터 생성
        refund = services.create_refund(db, payment, current_user.user_id, inquiry)

        return {
            "inquiry_id": inquiry.inquiry_id,
            "refund_id": refund.refund_id,
            "payment_number": str(payment_id),
            "status": "PENDING",
            "message": "환불 요청과 문의가 접수되었습니다. 답변은 입력하신 이메일로 발송됩니다."
        }

    except Exception as e:
        logging.error(f"Inquiry creation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "inquiry_submission_failed",
                "message": "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요."
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

# admin 관련 엔드 포인트
@router.get("/admin/payments", response_model=List[schemas.AdminPaymentListResponse])
async def get_admin_payments(
    query: Optional[str] = Query(None, description="검색어 (결제번호, 닉네임)"),
    payment_method: Optional[str] = Query(None, description="결제 수단 (manual, kakaopay)"),
    start_date: Optional[datetime] = Query(None, description="시작 날짜"),
    end_date: Optional[datetime] = Query(None, description="종료 날짜"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
    sort: str = Query("payment_date:desc", description="정렬 (field:asc|desc)"),
    status: Optional[str] = Query(None, description="결제 상태"),
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_admin_user)
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

@router.get("/admin/payments/{payment_id}", response_model=schemas.AdminPaymentDetailResponse)
def get_payment_detail(
    payment_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: user_schemas.User = Depends(get_current_admin_user)
):
    """
    단일 결제 상세 조회 API
    - 결제 내역, 환불 내역, 문의 내역을 포함하여 반환
    """
    payment = services.get_admin_payment_detail(db, payment_id)
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

@router.post("/admin/refunds/{inquiry_id}")
def admin_process_refund(inquiry_id: int, db: Session = Depends(get_db)):
    """
    환불 요청 승인 및 처리
    """
    try:
        refund = portone_services.issue_refund(inquiry_id=inquiry_id, db=db)
        return refund  # 그대로 반환 (schemas.AdminRefundResponse 강제 X)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unexpected error occurred.")

# 쿠폰 관련 엔드포인트
@router.get("/admin/coupons", response_model=List[schemas.CouponResponse])
async def list_coupons(db: Session = Depends(get_db)):
    """쿠폰 목록을 조회합니다."""
    return services.get_coupons(db)

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
    try:
        result = portone_services.verify_and_save_payment(payment_request, db)
        return result
    except HTTPException as e:
        logging.error(f"Payment processing error: {e.detail}")
        raise e
    except Exception as e:
        logging.error(f"Unexpected error during payment processing: {str(e)}")
        raise HTTPException(status_code=500, detail="결제 처리 중 오류가 발생했습니다.")


@router.post("/import/webhook")
async def import_webhook(request: Request, db: Session = Depends(get_db)):
    """
    포트원 웹훅 처리 라우터. 중복 처리 방지 및 정기 결제 예약 처리 포함.
    """
    try:
        # 요청 데이터 읽기
        body = await request.json()
        logging.info(f"Webhook received: {json.dumps(body, ensure_ascii=False)}")

        imp_uid = body.get("imp_uid")
        merchant_uid = body.get("merchant_uid")
        status = body.get("status")
        customer_uid = body.get("customer_uid", None)

        logging.info(f"Parsed body: imp_uid={imp_uid}, merchant_uid={merchant_uid}, status={status}, customer_uid={customer_uid}")

        if not imp_uid or not merchant_uid:
            raise HTTPException(status_code=400, detail="유효하지 않은 웹훅 요청입니다.")

        existing_payment = db.query(Payment).filter(
            Payment.payment_number == imp_uid
        ).first()
        if existing_payment:
            logging.info(f"Duplicate payment detected for imp_uid: {imp_uid}. Skipping.")
            return {"status": "duplicate", "message": "이미 처리된 결제 요청입니다."}

        token = portone_services.get_portone_token()
        payment_info = portone_services.get_portone_payment_info(imp_uid, token)
        logging.info(f"Payment info retrieved: {json.dumps(payment_info, ensure_ascii=False)}")

        name = payment_info.get("name")
        logging.info(f"Retrieved name from payment info: {name}")
        payment_type = portone_services.identify_payment_type(merchant_uid)
        logging.info(f"Payment type identified: {payment_type}")

        # 결제 방식 변경을 위한 결제는 처리하지 않음
        if "결제 방식 변경" in name:
            subscription = db.query(subscriprion_models.UserSubscription).filter(
                subscriprion_models.UserSubscription.subscription_number == payment_info["customer_uid"]
            ).first()
            portone_services.schedule_subscription_payment(subscription.subscription_id, db)
            logging.info(f"Skipping payment processing for method change. Name: {name}")
            return {"status": "skipped", "message": "결제 방식 변경 요청은 처리하지 않습니다."}

        if status == "paid":
            if payment_type == "single":
                logging.info("Processing single payment.")
                portone_services.process_single_payment(payment_info, db)
            elif payment_type == "subscription":
                logging.info("Processing subscription payment.")
                subscription = portone_services.process_subscription_payment(payment_info, db)
                portone_services.schedule_subscription_payment(subscription.subscription_id, db)
        elif status == "failed":
            if payment_type == "subscription":
                logging.info("Processing failed subscription payment.")
                portone_services.handle_failed_subscription_payment(payment_info, db)
            else:
                logging.warning(f"Failed payment for non-subscription type. Merchant UID: {merchant_uid}")
        else:
            logging.warning(f"Unhandled payment status: {status} for imp_uid: {imp_uid}")
        return {"status": "success", "message": "웹훅 처리 완료"}

    except HTTPException as e:
        logging.error(f"HTTPException during webhook processing: {e.detail}")
        raise e
    except Exception as e:
        logging.error(f"Unexpected error during webhook processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"웹훅 처리 중 오류: {str(e)}")

@router.post("/portone/mobile")
async def handle_mobile_redirect(
    imp_uid: str = Query(..., description="포트원 결제 고유 ID"),
    merchant_uid: str = Query(..., description="상점 거래 고유 ID"),
    success: str = Query(None, description="결제 성공 여부 (true/false)"),
    db: Session = Depends(get_db),
):
    """
    포트원 카카오페이 모바일 결제 리다이렉션 처리

    Args:
        imp_uid (str): 포트원에서 제공하는 결제 고유 ID.
        merchant_uid (str): 상점 거래 고유 ID.
        success (str): 결제 성공 여부 (true/false).
        db (Session): 데이터베이스 세션.
    """
    try:
        logging.info("모바일 결제 리다이렉션 요청 처리 시작")

        if success == "true":
            # 결제 검증 및 저장
            payment_request = schemas.PaymentCompleteRequest(imp_uid=imp_uid, merchant_uid=merchant_uid)
            portone_services.verify_and_save_payment(payment_request, db)

            # 성공 URL 생성 및 리다이렉트
            success_url = f"{settings.PORTONE_M_PAYMENT_RESULT_URL}?success"
            logging.info(f"결제 성공 - 리다이렉트 URL: {success_url}")
            return RedirectResponse(success_url)

        elif success == "false":
            # 실패 또는 취소 URL 생성 및 리다이렉트
            failure_url = f"{settings.PORTONE_M_PAYMENT_RESULT_URL}?fail&reason=payment_failed_or_cancelled"
            logging.warning(f"결제가 실패하거나 취소됨 - 리다이렉트 URL: {failure_url}")
            return RedirectResponse(failure_url)

        else:
            # 잘못된 요청 처리
            invalid_url = f"{settings.PORTONE_M_PAYMENT_RESULT_URL}?fail&reason=invalid_request"
            logging.error(f"잘못된 요청 - 리다이렉트 URL: {invalid_url}")
            return RedirectResponse(invalid_url)

    except HTTPException as e:
        # HTTPException 처리
        failure_reason = e.detail.get("detail") if isinstance(e.detail, dict) else str(e.detail)
        failure_url = f"{settings.PORTONE_M_PAYMENT_RESULT_URL}?fail&reason={failure_reason}"
        logging.error(f"결제 실패 - 리다이렉트 URL: {failure_url}")
        return RedirectResponse(failure_url)

    except Exception as e:
        # 기타 예외 처리
        error_url = f"{settings.PORTONE_M_PAYMENT_RESULT_URL}?fail&reason=server_error"
        logging.error(f"예상치 못한 오류 - 리다이렉트 URL: {error_url} - 오류: {str(e)}")
        return RedirectResponse(error_url)

@router.post("/portone/subscription/change")
async def change_subscription_payment_method(
    change_request: schemas.SubscriptionPaymentRequest,
    db: Session = Depends(get_db),
    current_user: user_schemas.User = Depends(get_current_active_user),
):
    """
    구독 결제 방식 변경 요청
    """
    return portone_services.initiate_change_payment_method(change_request, db, current_user)
