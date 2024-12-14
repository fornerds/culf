from fastapi import HTTPException, status
from sqlalchemy import extract, or_
from sqlalchemy.orm import Session, joinedload
from app.domains.token.models import TokenPlan
from app.domains.subscription.models import SubscriptionPlan
from app.domains.payment.models import Payment, Refund, Coupon, UserCoupon
from app.domains.inquiry.models import Inquiry
from app.domains.user.models import User
from app.domains.payment.schemas import CouponCreate, CouponUpdate, PaymentListResponse, CouponValidationResponse, PaycancelRequest, RefundResponse
from datetime import datetime
from typing import List, Optional
from uuid import UUID
import logging

logger = logging.getLogger("app")

class PaymentService:
# 상품 조회
    @staticmethod
    def get_all_products(db: Session):
        subscription_plans = db.query(SubscriptionPlan).all()
        token_plans = db.query(TokenPlan).all()
        return {"subscription_plans": subscription_plans, "token_plans": token_plans}

    @staticmethod
    def get_product_by_id(db: Session, product_id: int, product_type: str):
        if product_type == "subscription":
            return db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == product_id).first()
        elif product_type == "token":
            return db.query(TokenPlan).filter(TokenPlan.token_plan_id == product_id).first()
        return None

    @staticmethod
    def create_payment(db: Session, payment_data: Payment):
        # 결제 처리 로직
        # 여기서 외부 API 호출을 통해 결제를 처리하고 결과를 반환할 수 있습니다.
        # 예시로 가상의 결제 처리 결과를 사용합니다.
        payment_record = Payment(
            user_id=payment_data.user_id,
            subscription_id=payment_data.subscription_id,
            token_plan_id=payment_data.token_plan_id,
            payment_number="PAY123456",  # 실제 결제 ID로 대체
            tokens_purchased=payment_data.tokens_purchased,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            payment_date=datetime.utcnow(),
            status='SUCCESS',  # 실제 결제 상태로 대체
        )
        
        db.add(payment_record)
        db.commit()
        db.refresh(payment_record)
        return payment_record

    @staticmethod
    def get_me_payments(db: Session, user_id: int, page: int = 1, limit: int = 10, year: int = None, month: int = None):
        offset = (page - 1) * limit
        query = db.query(Payment).filter(Payment.user_id == user_id)

        if year:
            query = query.filter(extract('year', Payment.payment_date) == year)
        if month:
            query = query.filter(extract('month', Payment.payment_date) == month)

        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_payment_detail(db: Session, payment_id: int):
        return db.query(Payment).filter(Payment.payment_id == payment_id).first()

    @staticmethod
    def inquiry_payment(db: Session, payment_id: UUID, user_id: str, refund_request: PaycancelRequest):
        # 결제 내역 조회
        payment = db.query(Payment).filter(Payment.payment_id == payment_id, Payment.user_id == user_id).first()
        if not payment:
            return None

        # Inquiry(문의) 생성
        inquiry = Inquiry(
            user_id=user_id,
            type="payment",
            title=refund_request.title,
            email=refund_request.email,
            contact=refund_request.contact,
            content=refund_request.content,
            attachment=refund_request.attachment,
            status="PENDING",
            created_at=datetime.now()
        )
        db.add(inquiry)
        db.commit()
        db.refresh(inquiry)

        # Refund(환불) 생성
        refund = Refund(
            payment_id=payment.payment_id,
            user_id=user_id,
            inquiry_id=inquiry.inquiry_id,  # 생성된 문의 ID 연결
            amount=payment.amount,
            reason=refund_request.content,
            status="PENDING",
            created_at=datetime.now()
        )
        db.add(refund)
        db.commit()
        db.refresh(refund)

        return {"inquiry": inquiry, "refund": refund}

    @staticmethod
    def create_refund(db: Session, refund_data: Refund):
        db.add(refund_data)
        db.commit()
        db.refresh(refund_data)
        return refund_data

    @staticmethod
    def get_refunds(db: Session, user_id: int, page: int = 1, limit: int = 10):
        offset = (page - 1) * limit
        return db.query(Refund).filter(Refund.user_id == user_id).offset(offset).limit(limit).all()

    @staticmethod
    def get_refund_detail(db: Session, refund_id: int):
        return db.query(Refund).filter(Refund.refund_id == refund_id).first()

    @staticmethod
    def process_refund(db: Session, refund_id: int, processed_by: int):
        refund = db.query(Refund).filter(Refund.refund_id == refund_id).first()
        if refund:
            refund.status = 'APPROVED'  # 또는 'REJECTED'로 설정
            refund.processed_at = datetime.utcnow()
            refund.processed_by = processed_by
            db.commit()
            db.refresh(refund)
            return refund
        return None

# 쿠폰 사용 관련 서비스 코드
    @staticmethod
    def get_coupon_by_code(db, coupon_code):
        logger.info(f"Fetching coupon with code: {coupon_code}")
        coupon = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
        if not coupon:
            logger.warning(f"No coupon found with code: {coupon_code}")
        else:
            logger.info(f"Coupon details: {coupon}")
        return coupon
    
    @staticmethod
    def calculate_discount(coupon: Coupon, original_price: float) -> float:
        if coupon.discount_type == "RATE":
            return original_price * (coupon.discount_value / 100)
        elif coupon.discount_type == "AMOUNT":
            return coupon.discount_value
        return 0
    
    @staticmethod
    def record_coupon_usage(db: Session, user_id: str, coupon_id: int):
        user_coupon = UserCoupon(user_id=user_id, coupon_id=coupon_id, used_at=datetime.now())
        db.add(user_coupon)
        db.commit()

    @staticmethod
    def create_coupon(db: Session, coupon_data: CouponCreate):
        coupon = Coupon(**coupon_data.dict())
        db.add(coupon)
        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def update_coupon(db: Session, coupon_id: int, coupon_data: CouponUpdate):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        
        for key, value in coupon_data.dict(exclude_unset=True).items():
            setattr(coupon, key, value)

        db.commit()
        db.refresh(coupon)
        return coupon

    @staticmethod
    def delete_coupon(db: Session, coupon_id: int):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        
        db.delete(coupon)
        db.commit()

    @staticmethod
    def get_coupon(db: Session, coupon_id: int):
        coupon = db.query(Coupon).filter(Coupon.coupon_id == coupon_id).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
        return coupon

    @staticmethod
    def validate_coupon(db: Session, coupon_code: str, user_id: str):
        # 쿠폰 조회
        coupon = db.query(Coupon).filter(Coupon.coupon_code == coupon_code).first()
        if not coupon:
            return CouponValidationResponse(is_valid=False, reason="Coupon not found")

        # 유효 기간 확인 (date 타입 비교)
        today = datetime.now().date()  # 현재 날짜를 date 타입으로 변환
        if coupon.valid_from and coupon.valid_to:  # 유효 기간이 설정된 경우에만 확인
            if today < coupon.valid_from or today > coupon.valid_to:
                return CouponValidationResponse(is_valid=False, reason="Coupon is expired or not yet valid")

        # 최대 사용 횟수 확인
        if coupon.max_usage and coupon.used_count >= coupon.max_usage:
            return CouponValidationResponse(is_valid=False, reason="Coupon usage limit exceeded")

        # 사용자가 이미 쿠폰을 사용했는지 확인
        user_coupon = db.query(UserCoupon).filter(UserCoupon.user_id == user_id, UserCoupon.coupon_id == coupon.coupon_id).first()
        if user_coupon:
            return CouponValidationResponse(is_valid=False, reason="Coupon already used by the user")

        return CouponValidationResponse(is_valid=True)

# admin
    @staticmethod
    def get_payment_detail(db: Session, payment_id: UUID):
        payment = (
            db.query(Payment)
            .filter(Payment.payment_id == payment_id)
            .options(
                joinedload(Payment.refunds),  # 환불 데이터 로드
                joinedload(Payment.user),  # 사용자 데이터 로드
            )
            .first()
        )

        if not payment:
            return None

        # 첫 번째 환불 데이터 가져오기 (단일 객체로 변환)
        refund = None
        if payment.refunds:
            refund_obj = payment.refunds[0]  # 첫 번째 환불 데이터
            refund = {
                "refund_id": refund_obj.refund_id,
                "payment_id": refund_obj.payment_id,
                "amount": refund_obj.amount,
                "reason": refund_obj.reason,
                "status": refund_obj.status,
                "processed_at": refund_obj.processed_at,
                "created_at": refund_obj.created_at,
            }

        # 문의 내역
        inquiries = []
        if payment.refunds:  # 환불에 연결된 문의 정보
            for refund in payment.refunds:
                if refund.inquiry:
                    inquiry = refund.inquiry
                    inquiries.append({
                        "inquiry_id": inquiry.inquiry_id,
                        "type": inquiry.type,
                        "title": inquiry.title,
                        "email": inquiry.email,
                        "contact": inquiry.contact,
                        "content": inquiry.content,
                        "status": inquiry.status,
                        "created_at": inquiry.created_at,
                    })

        return {
            "payment_id": payment.payment_id,
            "payment_number": payment.payment_number,
            "amount": payment.amount,
            "status": payment.status,
            "payment_date": payment.payment_date,
            "payment_method": payment.payment_method,
            "user_nickname": payment.user.nickname if payment.user else None,
            "refund": refund,  # 단일 환불 데이터 반환
            "inquiries": inquiries,  # 리스트 반환
        }

    @staticmethod
    def create_manual_payment(db: Session, payment_data: dict) -> Payment:
        # 수동 결제 처리 껍데기 코드
        payment = Payment(**payment_data)
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def process_refund(db: Session, payment_id: UUID, refund_data: dict) -> Refund:
        # 환불 처리 껍데기 코드
        refund = Refund(payment_id=payment_id, **refund_data)
        db.add(refund)
        db.commit()
        db.refresh(refund)
        return refund

    @staticmethod
    def get_admin_payments(
        db: Session,
        query: Optional[str],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        page: int,
        limit: int,
        sort: str
    ) -> List[PaymentListResponse]:
        query_builder = db.query(
            Payment,
            User.nickname.label("user_nickname"),
            Refund
        ).join(User, Payment.user_id == User.user_id, isouter=True).join(
            Refund, Payment.payment_id == Refund.payment_id, isouter=True
        )

        # 검색어 필터 적용
        if query:
            query_builder = query_builder.filter(
                or_(
                    Payment.payment_id.ilike(f"%{query}%"),
                    User.nickname.ilike(f"%{query}%"),
                    Payment.payment_method.ilike(f"%{query}%"),
                    Payment.manual_payment_reason.ilike(f"%{query}%")  # 결제 상품 관련 추가 정보
                )
            )

        # 기간 필터 적용
        if start_date and end_date:
            query_builder = query_builder.filter(
                Payment.payment_date.between(start_date, end_date)
            )

        # 정렬
        sort_column, sort_direction = sort.split(":")
        if sort_direction == "desc":
            query_builder = query_builder.order_by(getattr(Payment, sort_column).desc())
        else:
            query_builder = query_builder.order_by(getattr(Payment, sort_column))

        # 페이징
        results = query_builder.offset((page - 1) * limit).limit(limit).all()

        # 데이터 변환
        payments = []
        for payment, user_nickname, refund in results:
            payments.append(
                PaymentListResponse(
                    payment_id=payment.payment_id,
                    user_nickname=user_nickname,
                    product_name=None,  # 필요 시 수정
                    amount=payment.amount,
                    payment_method=payment.payment_method,
                    status=payment.status,
                    payment_date=payment.payment_date,
                    refund=RefundResponse.from_orm(refund) if refund else None
                )
            )

        return payments

