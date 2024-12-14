from decimal import Decimal
import requests
import os
from datetime import datetime, timedelta
from app.domains.payment.models import Coupon, Payment, Refund, UserCoupon
from app.domains.token.models import Token, TokenPlan
from app.domains.user.models import User
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.domains.payment.schemas import KakaoPayRequest, KakaoPayApproval, KakaoPaySubscriptionRequest
from app.domains.payment.services import PaymentService
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from sqlalchemy.exc import IntegrityError
import uuid
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
global_cache = None

class KakaoPayService:
    def __init__(self):
        self.base_url = "https://open-api.kakaopay.com/online/v1/payment"
        self.secret_key = os.getenv("SECRET_KEY")
        self.cid_one = os.getenv("CID_ONE")
        self.cid_sub = os.getenv("CID_SUB")
        self.cid_seq = os.getenv("CID_SEQ")
        self.dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
        self.cache_store = None

    def set_cache(self, value):
        global global_cache
        global_cache = value
        logger.info(f"Global cache set: {global_cache}")

    def get_cache(self):
        global global_cache
        logger.info(f"Global cache retrieved: {global_cache}")
        return global_cache

    def get_token_plan(self, db: Session, plan_id: int):
        token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == plan_id).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")
        return token_plan

    def initiate_payment(self, payment_request: KakaoPayRequest, token_plan: TokenPlan, db: Session, current_user: User):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # 쿠폰 처리
        discount_amount = Decimal(0)
        coupon = None

        if payment_request.coupon_code:
            coupon = PaymentService.get_coupon_by_code(db, payment_request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="유효하지 않은 쿠폰 코드입니다.")
            
            if coupon.discount_type == 'AMOUNT':
                discount_amount = Decimal(coupon.discount_value)
            elif coupon.discount_type == 'RATE':
                discount_amount = Decimal(token_plan.price) * Decimal(coupon.discount_value / 100)

            # 기타 사용 한도와 기간 체크
            if coupon.used_count >= (coupon.max_usage or 0):
                raise HTTPException(status_code=400, detail="사용 한도가 초과된 쿠폰입니다.")
            if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
                raise HTTPException(status_code=400, detail="쿠폰 사용 기간이 아닙니다.")

        # 총 결제 금액 계산
        total_amount = max(Decimal(token_plan.price) - discount_amount, Decimal(0)) * payment_request.quantity
        partner_order_id = str(uuid.uuid4())
        data = {
            "cid": self.cid_one,
            "partner_order_id": partner_order_id,
            "partner_user_id": str(current_user.user_id),
            "item_name": f"{token_plan.tokens} tokens",
            "quantity": payment_request.quantity,
            "total_amount": float(total_amount),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": "http://localhost:8000/v1/pay/success",
            "cancel_url": "http://localhost:8000/v1/pay/cancel",
            "fail_url": "http://localhost:8000/v1/pay/fail",
        }

        try:
            response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
            response_data = response.json()
            
            # 추가 디버깅 로그
            logger.info(f"API response status: {response.status_code}, response data: {response_data}")
            logger.info(f"Sent data for payment: {data}")
            
            if response.status_code == 200:
                tid = response_data.get("tid")
                
                # 결제 데이터 INSERT
                payment = Payment(
                    payment_id=partner_order_id,
                    user_id=current_user.user_id,
                    token_plan_id=token_plan.token_plan_id,
                    payment_number=tid,
                    tokens_purchased=token_plan.tokens * payment_request.quantity,
                    amount=float(total_amount),
                    payment_method="KakaoPay_OneTime",
                    payment_date=datetime.now(),
                    used_coupon_id=coupon.coupon_id if coupon else None,
                    status="CANCELLED"
                )
                db.add(payment)
                db.commit()
                
                # 캐시에 결제 정보 저장
                self.set_cache({
                    "cid": self.cid_one,
                    "tid": tid,
                    "partner_order_id": partner_order_id,
                    "partner_user_id": str(current_user.user_id)
                })
                # 캐시 설정 후 즉시 확인
                cached_data = self.get_cache()
                logger.info(f"Immediately retrieved cache after setting: {cached_data}")
                
                # 환경에 따른 Redirect URL 반환
                if payment_request.environment == "pc":
                    redirect_url = response_data.get("next_redirect_pc_url")
                elif payment_request.environment == "mobile":
                    redirect_url = response_data.get("next_redirect_mobile_url")
                elif payment_request.environment == "app":
                    redirect_url = response_data.get("next_redirect_app_url")
                else:
                    raise HTTPException(status_code=400, detail="Invalid environment specified")

                return {"redirect_url": redirect_url}
            else:
                logger.error(f"Payment initiation failed: {response_data.get('msg')}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except IntegrityError as e:
            db.rollback()
            logger.error(f"Database IntegrityError: {str(e)}")
            raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
        except Exception as e:
            db.rollback()
            logger.error(f"Unexpected error during payment initiation: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))

    def approve_payment(self, pg_token: str, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        payment_info = self.get_cache()
        if not payment_info:
            logger.error("Failed to retrieve payment information from cache.")
            raise HTTPException(status_code=400, detail="Failed to retrieve payment information.")

        # 추가 로그
        logger.info(f"Retrieved payment information from cache: {payment_info}")

        try:
            data = {
                "cid": payment_info["cid"],
                "tid": payment_info["tid"],
                "partner_order_id": payment_info["partner_order_id"],
                "partner_user_id": payment_info["partner_user_id"],
                "pg_token": pg_token,
            }

            response = requests.post(f"{self.base_url}/approve", headers=headers, json=data)
            response_data = response.json()

            if response.status_code == 200:
                payment = db.query(Payment).filter(Payment.payment_number == payment_info["tid"]).first()
                if payment:
                    payment.status = "SUCCESS"
                    payment.transaction_number = response_data.get("aid")
                    payment.payment_date = response_data.get("approved_at")
                    db.commit()

                    logger.info(f"Payment subscription_id: {payment.subscription_id}")

                    # 정기결제 처리
                    if payment_info["cid"] == "TCSUBSCRIP":
                        user_subscription = db.query(UserSubscription).filter(
                            UserSubscription.subscription_id == payment.subscription_id
                        ).first()

                        if user_subscription:
                            logger.info(f"User subscription found: {user_subscription}")
                        else:
                            logger.error(f"User subscription not found for subscription_id: {payment.subscription_id}")

                        if user_subscription:
                            # 'sid' 값을 subscription_number에 저장
                            user_subscription.subscription_number = response_data.get("sid")
                            user_subscription.status = "ACTIVE"
                            db.commit()

                            logger.info(f"User subscription updated successfully for user_id: {payment.user_id}")

                    # 토큰 테이블 업데이트
                    token = db.query(Token).filter(Token.user_id == payment.user_id).first()

                    if not token:
                        # 유저에 대한 토큰 정보가 없을 경우 새로 생성
                        token = Token(
                            user_id=payment.user_id,
                            total_tokens=payment.tokens_purchased,
                            used_tokens=0,
                            last_charged_at=payment.payment_date,
                            expires_at=payment.payment_date + timedelta(days=365),
                        )
                        db.add(token)
                        logger.info(f"New token entry created for user_id: {payment.user_id}")
                    else:
                        # 기존 토큰 정보 업데이트
                        token.total_tokens += payment.tokens_purchased
                        token.last_charged_at = payment.payment_date
                        token.expires_at = payment.payment_date + timedelta(days=365)
                        logger.info(f"Token entry updated for user_id: {payment.user_id}")

                    db.commit()

                return KakaoPayApproval(**response_data)
            else:
                logger.error(f"Payment approval failed with response: {response_data}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except Exception as e:
            logger.error(f"Exception occurred during payment approval process: {str(e)}")
            raise HTTPException(status_code=400, detail="An error occurred while processing the payment approval.")

    def initiate_subscription(self, subscription_request: KakaoPaySubscriptionRequest, db: Session, current_user: User):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # 구독 플랜 조회
        subscription_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.plan_id == subscription_request.plan_id
        ).first()

        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Invalid subscription plan")

        # 쿠폰 처리
        discount_amount = Decimal(0)
        coupon = None

        if subscription_request.coupon_code:
            coupon = PaymentService.get_coupon_by_code(db, subscription_request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="유효하지 않은 쿠폰 코드입니다.")

            if coupon.discount_type == 'AMOUNT':
                discount_amount = Decimal(coupon.discount_value)
            elif coupon.discount_type == 'RATE':
                discount_amount = Decimal(subscription_plan.discounted_price) * Decimal(coupon.discount_value / 100)

            # 기타 사용 한도와 기간 체크
            if coupon.used_count >= (coupon.max_usage or 0):
                raise HTTPException(status_code=400, detail="사용 한도가 초과된 쿠폰입니다.")
            if not (coupon.valid_from <= datetime.now().date() <= coupon.valid_to):
                raise HTTPException(status_code=400, detail="쿠폰 사용 기간이 아닙니다.")

        # 총 결제 금액 계산
        total_amount = max(Decimal(subscription_plan.discounted_price) - discount_amount, Decimal(0)) * subscription_request.quantity
        partner_order_id = str(uuid.uuid4())
        data = {
            "cid": self.cid_sub,
            "partner_order_id": partner_order_id,
            "partner_user_id": str(current_user.user_id),
            "item_name": subscription_plan.plan_name,
            "quantity": 1,
            "total_amount": float(total_amount),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": "http://localhost:8000/v1/pay/success",
            "cancel_url": "http://localhost:8000/v1/pay/cancel",
            "fail_url": "http://localhost:8000/v1/pay/fail",
        }

        try:
            response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
            response_data = response.json()
            
            logger.info(f"API response status: {response.status_code}, response data: {response_data}")
            logger.info(f"Sent data for subscription payment: {data}")

            if response.status_code == 200:
                tid = response_data.get("tid")

                # 결제 데이터 INSERT
                subscription = UserSubscription(
                    user_id=current_user.user_id,
                    plan_id=subscription_plan.plan_id,
                    start_date=datetime.now().date(),
                    next_billing_date=(datetime.now() + timedelta(days=30)).date(),
                    status="CANCELLED",
                    subscriptions_method="KakaoPay_Subscription"
                )
                db.add(subscription)
                db.commit()
                db.refresh(subscription)

                # 결제 기록 저장
                payment = Payment(
                    payment_id=partner_order_id,
                    user_id=current_user.user_id,
                    subscription_id=subscription.subscription_id,
                    payment_number=tid,
                    tokens_purchased=subscription_plan.tokens_included * subscription_request.quantity, 
                    amount=float(total_amount),
                    payment_method="KakaoPay_Subscription",
                    payment_date=datetime.now(),
                    used_coupon_id=coupon.coupon_id if coupon else None,
                    status="CANCELLED"
                )
                db.add(payment)
                db.commit()

                # 캐시 설정 후 즉시 데이터 확인
                self.set_cache({
                    "cid": self.cid_sub,
                    "tid": tid,
                    "partner_order_id": partner_order_id,
                    "partner_user_id": str(current_user.user_id),
                    "subscription_id": subscription.subscription_id
                })
                cached_data = self.get_cache()
                logger.info(f"Immediately retrieved cache after setting: {cached_data}")

                # 환경에 따른 Redirect URL 반환
                if subscription_request.environment == "pc":
                    redirect_url = response_data.get("next_redirect_pc_url")
                elif subscription_request.environment == "mobile":
                    redirect_url = response_data.get("next_redirect_mobile_url")
                elif subscription_request.environment == "app":
                    redirect_url = response_data.get("next_redirect_app_url")
                else:
                    raise HTTPException(status_code=400, detail="Invalid environment specified")

                return {"redirect_url": redirect_url}
            else:
                logger.error(f"Subscription initiation failed: {response_data.get('msg')}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except IntegrityError as e:
            db.rollback()
            logger.error(f"Database IntegrityError: {str(e)}")
            raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
        except Exception as e:
            db.rollback()
            logger.error(f"Unexpected error during subscription initiation: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))

    def pay_subscription(self, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # Fetch active subscriptions with next_billing_date equal to today
        today = datetime.now().date()
        active_subscriptions = db.query(UserSubscription).filter(
            UserSubscription.next_billing_date == today,
            UserSubscription.status == "ACTIVE"
        ).all()

        if not active_subscriptions:
            logger.info("No active subscriptions to process today.")
            return

        for subscription in active_subscriptions:
            # Fetch subscription plan details from the database
            subscription_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.plan_id == subscription.plan_id
            ).first()
            if not subscription_plan:
                logger.error(f"Subscription plan not found for plan_id: {subscription.plan_id}")
                continue

            # Prepare the data for paying a subscription
            data = {
                "cid": self.cid_sub,
                "sid": subscription.subscription_number,
                "partner_order_id": f"{uuid.uuid4()}",
                "partner_user_id": subscription.user_id,
                "item_name": subscription_plan.plan_name,
                "quantity": 1,
                "total_amount": float(subscription_plan.price),
                "vat_amount": 0,
                "tax_free_amount": 0,
            }
            response = requests.post(f"{self.base_url}/subscription", headers=headers, json=data)
            response_data = response.json()

            # Handle the response from KakaoPay
            if response.status_code == 200:
                logger.info(f"Subscription payment successful for user_id: {subscription.user_id}")
                # Save payment details to the Payments table
                payment = Payment(
                    payment_id=f"order_{uuid.uuid4()}",
                    user_id=subscription.user_id,
                    subscription_id=subscription.subscription_id,
                    payment_number=response_data.get("tid"),
                    amount=float(subscription_plan.price),
                    payment_method="KakaoPay_subscription",
                    payment_date=datetime.now(),
                    status="SUCCESS",
                    transaction_number=response_data.get("aid")
                )
                db.add(payment)

                # Update next_billing_date for the subscription
                subscription.next_billing_date = today + timedelta(days=subscription_plan.billing_cycle)
                db.commit()
            else:
                logger.error(f"Subscription payment failed for user_id: {subscription.user_id}, reason: {response_data.get('msg')}")
                # Optionally, update subscription status or notify user of the failure

        logger.info("Subscription payments processed.")

    def cancel_subscription(self, user_id: str, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # Fetch the subscription by user_id
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'ACTIVE'
        ).first()

        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found for the given user_id")

        # Prepare the data for canceling a subscription
        data = {
            "cid": self.cid_sub,
            "sid": subscription.subscription_number,
        }

        response = requests.post(f"{self.base_url}/manage/subscription/inactive", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            # Update subscription status and set subscription_number to None
            subscription.status = 'CANCELLED'
            db.commit()
            return response_data
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    def get_subscription_status(self, user_id: str, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # Fetch the subscription by user_id
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == 'ACTIVE'
        ).first()

        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found for the given user_id")

        # Prepare the data for canceling a subscription
        data = {
            "cid": self.cid_sub,
            "sid": subscription.subscription_number,
        }

        response = requests.post(f"{self.base_url}/manage/subscription/status", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            return response_data
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    def process_refund(self, payment_id: uuid, refund_data: dict, db: Session):
        """
        카카오페이를 통해 환불 처리 및 환불 기록 저장
        """
        # 결제 내역 확인
        payment = db.query(Payment).filter(Payment.payment_id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # 환불 금액 검증
        cancel_amount = refund_data.get("amount")
        if not cancel_amount or cancel_amount <= 0 or cancel_amount > payment.amount:
            raise HTTPException(status_code=400, detail="Invalid refund amount")

        # 카카오페이 API 요청 헤더
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # 카카오페이 환불 요청 데이터
        data = {
            "cid": self.cid_one,
            "tid": payment.payment_number,
            "cancel_amount": cancel_amount,
            "cancel_tax_free_amount": refund_data.get("cancel_tax_free_amount", 0),
            "cancel_vat_amount": refund_data.get("cancel_vat_amount"),  # 선택 사항
        }

        # 카카오페이 API 호출
        try:
            response = requests.post(f"{self.base_url}/cancel", headers=headers, json=data)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=500, detail=f"KakaoPay API request failed: {str(e)}")

        response_data = response.json()

        # 카카오페이 응답 검증
        if response.status_code != 200 or response_data.get("status") not in ["CANCEL_PAYMENT", "PART_CANCEL_PAYMENT"]:
            error_message = response_data.get("error_message", "Unknown error occurred")
            raise HTTPException(status_code=400, detail=f"Refund failed: {error_message}")

        # 환불 정보 저장
        refund = Refund(
            payment_id=payment.payment_id,
            user_id=payment.user_id,
            amount=cancel_amount,
            reason=refund_data.get("reason", "No reason provided"),
            status="APPROVED",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        payment.status = "CANCEL_PAYMENT" if response_data.get("status") == "CANCEL_PAYMENT" else "PART_CANCEL_PAYMENT"

        db.add(refund)
        db.commit()
        db.refresh(refund)

        return refund

