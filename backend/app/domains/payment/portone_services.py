from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import requests
import uuid
import logging

from app.domains.user.models import User
from app.domains.token.models import TokenPlan
from app.domains.payment.models import Payment, Coupon, PaymentCache, UserCoupon
from app.domains.payment import services as payment_service
from app.domains.payment.services import PaymentService
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.core.config import settings

logger = logging.getLogger("app")

class PortoneServices:
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
    M_REDIRECT_URL = "https://your-redirect-url.com/payment-complete"

    def initiate_one_time_payment(self, payment_request, db: Session, current_user):
        """단건 결제 요청"""
        token_plan = db.query(TokenPlan).filter(
            TokenPlan.token_plan_id == payment_request.plan_id
        ).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")

        # 토큰 플랜의 결제 기준 금액 선택
        base_price = float(token_plan.discounted_price or token_plan.price)

        # 쿠폰 유효성 검증
        discount_amount = 0
        if payment_request.coupon_code:
            coupon_validation = payment_service.validate_coupon(db, payment_request.coupon_code, current_user.user_id)
            if not coupon_validation["is_valid"]:
                raise HTTPException(status_code=400, detail=coupon_validation["message"])
            discount_amount = coupon_validation["discount_value"]

        # 최종 결제 금액
        final_price = max(base_price - discount_amount, 0)

        merchant_uid = str(uuid.uuid4())

        payment_data = {
            "channelKey": self.CHANNEL_KEYS[payment_request.pg],
            "merchant_uid": merchant_uid,
            "name": f"{token_plan.tokens} tokens",
            "amount": final_price,
            "buyer_email": current_user.email,
            "buyer_name": current_user.nickname,
            "buyer_tel": current_user.phone_number,
        }

        # PG사별 추가 파라미터 처리 및 결제 방식 설정
        payment_method = "one"
        if payment_request.pg == "kakaopay":
            payment_data["m_redirect_url"] = self.M_REDIRECT_URL
        elif payment_request.pg == "danal_tpay":
            pay_method = payment_request.pay_method or "card"
            if pay_method not in {"card", "trans", "vbank"}:
                raise HTTPException(status_code=400, detail="Invalid pay_method for danal_tpay")
            payment_data["pay_method"] = pay_method
            payment_method = f"one_{pay_method}"
            if pay_method == "vbank":
                payment_data["biz_num"] = self.DANAL_BIZ_NUM
        elif payment_request.pg == "danal":
            payment_data["pay_method"] = "phone"
            payment_method = "one_phone"
        else:
            raise HTTPException(status_code=400, detail="Unsupported PG provider")

        # PaymentCache 생성 및 저장
        payment_cache = PaymentCache(
            user_id=current_user.user_id,
            merchant_uid=merchant_uid,
            payment_method=payment_method,
            token_plan_id=token_plan.token_plan_id,
            coupon_id=payment_request.coupon_id,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=1),
        )
        db.add(payment_cache)
        db.commit()

        return {
            "merchant_uid": merchant_uid,
            "payment_data": payment_data,
        }

    def issue_billing_key(self, subscription_request, current_user):
        """빌링키 발급 요청"""
        customer_uid = f"{current_user.user_id}-customer"
        billing_key_data = {
            "pg": self.CHANNEL_KEYS[subscription_request.pg],
            "customer_uid": customer_uid,
            "card_number": subscription_request.card_number,
            "expiry": subscription_request.expiry,
            "birth": subscription_request.birth,
            "pwd_2digit": subscription_request.pwd_2digit,
        }
        response = requests.post(
            f"{self.PORTONE_API_URL}/subscribe/customers/{customer_uid}",
            json=billing_key_data,
            headers={"Authorization": f"Bearer {self.get_access_token()}"}
        )
        if not response.ok:
            raise HTTPException(status_code=400, detail="Billing key issuance failed")
        return customer_uid

    def initiate_subscription_payment(self, subscription_request, db: Session, current_user):
        """구독 결제 요청"""
        # 빌링키 발급
        customer_uid = self.issue_billing_key(subscription_request, current_user)

        # 플랜 조회
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == subscription_request.plan_id
        ).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Subscription plan not found")

        # 결제 요청 데이터 생성
        payment_data = {
            "customer_uid": customer_uid,
            "merchant_uid": str(uuid.uuid4()),
            "amount": float(subscription_plan.price),
            "name": subscription_plan.plan_name,
            "buyer_email": current_user.email,
            "buyer_name": current_user.nickname,
            "buyer_tel": current_user.phone_number,
        }
        response = requests.post(
            f"{self.PORTONE_API_URL}/subscribe/payments/again",
            json=payment_data,
            headers={"Authorization": f"Bearer {self.get_access_token()}"}
        )
        if not response.ok:
            raise HTTPException(status_code=400, detail="Subscription payment failed")
        return response.json()

    def schedule_subscription_payment(self, customer_uid, amount, name, next_schedule_time):
        """반복 결제 예약"""
        schedule_data = {
            "customer_uid": customer_uid,
            "schedules": [
                {
                    "merchant_uid": str(uuid.uuid4()),
                    "schedule_at": next_schedule_time,
                    "amount": amount,
                    "name": name,
                }
            ],
        }
        response = requests.post(
            f"{self.PORTONE_API_URL}/subscribe/payments/schedule",
            json=schedule_data,
            headers={"Authorization": f"Bearer {self.get_access_token()}"}
        )
        if not response.ok:
            raise HTTPException(status_code=400, detail="Subscription scheduling failed")
        return response.json()

    @classmethod
    def _get_portone_token(cls):
        """포트원 토큰 발급"""
        response = requests.post(
            f"{cls.PORTONE_API_URL}/users/getToken",
            json={"imp_key": cls.IMP_KEY, "imp_secret": cls.IMP_SECRET},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to get Portone token")
        return response.json()["response"]["access_token"]

    @classmethod
    def _get_payment_info(cls, imp_uid, token):
        """결제 상태 조회"""
        response = requests.get(
            f"{cls.PORTONE_API_URL}/payments/{imp_uid}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch payment info")
        return response.json()["response"]

    @classmethod
    def verify_and_save_payment(cls, payment_request, db: Session):
        """결제 검증 및 저장"""
        token = cls._get_portone_token()
        payment_info = cls._get_payment_info(payment_request.imp_uid, token)

        if (
            payment_info["amount"] != payment_request.expected_amount
            or payment_info["status"] != "paid"
        ):
            raise HTTPException(status_code=400, detail="Payment verification failed")

        payment_cache = db.query(PaymentCache).filter(
            PaymentCache.merchant_uid == payment_request.merchant_uid
        ).first()

        if not payment_cache:
            raise HTTPException(status_code=404, detail="Payment cache not found")

        payment_record = Payment(
            payment_id=payment_request.merchant_uid,
            user_id=payment_cache.user_id,
            token_plan_id=payment_cache.token_plan_id,
            coupon_id=payment_cache.coupon_id,
            payment_number=payment_info["imp_uid"],
            amount=payment_info["amount"],
            payment_method=payment_cache.payment_method,
            payment_date=datetime.fromtimestamp(payment_info["paid_at"]),
            status="SUCCESS",
        )
        db.add(payment_record)

        if payment_cache.token_plan_id:
            PaymentService._process_tokens(payment_record, db)

        if payment_cache.coupon_id:
            coupon = db.query(Coupon).filter(Coupon.coupon_id == payment_cache.coupon_id).first()
            if coupon:
                coupon.used_count += 1
                db.add(coupon)

            user_coupon = UserCoupon(
                user_id=payment_cache.user_id,
                coupon_id=payment_cache.coupon_id,
                used_at=datetime.now()
            )
            db.add(user_coupon)

        if payment_cache.subscription_id:
            subscription = db.query(UserSubscription).filter(
                UserSubscription.subscription_id == payment_cache.subscription_id
            ).first()

            if subscription:
                subscription.next_billing_date = payment_request.next_billing_date
                db.add(subscription)

        db.delete(payment_cache)
        db.commit()

        return {"success": True, "message": "Payment verified and saved"}