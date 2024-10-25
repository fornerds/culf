import requests
import os
from datetime import datetime, timedelta
from app.domains.payment.models import Payment, Refund, Coupon
from app.domains.token.models import TokenPlan
from app.domains.user.models import User
from app.domains.subscription.models import SubscriptionPlan, UserSubscription
from app.domains.payment.schemas import KakaoPayRequest, KakaoPayApproval, KakaoPaySubscriptionRequest
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from sqlalchemy.exc import IntegrityError
import uuid
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

class KakaoPayService:
    def __init__(self):
        # Base URL for KakaoPay API
        self.base_url = "https://open-api.kakaopay.com/online/v1/payment"
        # Secret key for authentication, loaded from environment variables
        self.secret_key = os.getenv("SECRET_KEY")
        # CID for one-time payments
        self.cid_one = os.getenv("CID_ONE")
        # CID for subscription payments
        self.cid_sub = os.getenv("CID_SUB")
        # CID for sequential payments
        self.cid_seq = os.getenv("CID_SEQ")
        # Development mode flag to bypass authentication in non-production environments
        self.dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"

        # 간단한 캐시 저장소 초기화
        self.cache_store = None

    def set_cache(self, value):
        self.cache_store = value

    def get_cache(self):
        return self.cache_store

    @staticmethod
    def get_token_plan(db: Session, plan_id: int):
        token_plan = db.query(TokenPlan).filter(TokenPlan.token_plan_id == plan_id).first()
        if not token_plan:
            raise HTTPException(status_code=404, detail="Token plan not found")
        return token_plan

    def initiate_payment(self, payment_request: KakaoPayRequest, token_plan: TokenPlan, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # `partner_order_id`를 미리 생성
        partner_order_id = f"{uuid.uuid4()}"  # UUID를 사용해 고유한 partner_order_id 생성

        # 결제 요청 데이터 생성
        total_amount = token_plan.price * payment_request.quantity
        item_name = f"{token_plan.tokens} tokens"
        data = {
            "cid": self.cid_one,
            "partner_order_id": partner_order_id,  # 생성한 `partner_order_id` 사용
            "partner_user_id": payment_request.partner_user_id,
            "item_name": item_name,
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

            if response.status_code == 200:
                # 결제 트랜잭션 커밋
                tid = response_data.get("tid")

                payment = Payment(
                    payment_id=partner_order_id,
                    user_id=payment_request.partner_user_id,
                    token_plan_id=token_plan.token_plan_id,
                    payment_number=tid,
                    amount=float(total_amount),
                    payment_method="KakaoPay_OneTime",
                    payment_date=datetime.now(),
                    used_coupon_id=getattr(payment_request, 'coupon_id', None),  
                    status="FAILED"
                )
                logger.info(f"Payment 객체: {payment}")
                try:
                    db.add(payment)
                    db.commit()
                except IntegrityError as e:
                    logger.error(f"결제 정보 삽입 중 IntegrityError 발생: {e}")
                    db.rollback()
                    raise HTTPException(status_code=500, detail="결제 정보를 저장하는 중 문제가 발생했습니다.")
                except Exception as e:
                    logger.error(f"결제 정보 삽입 중 예외 발생: {e}")
                    db.rollback()
                    raise HTTPException(status_code=400, detail="결제 정보를 저장하는 중 문제가 발생했습니다.")

                # 결제 관련 정보 캐시에 저장
                self.set_cache({
                    "cid": self.cid_one,
                    "tid": tid,
                    "partner_order_id": partner_order_id,
                    "partner_user_id": payment_request.partner_user_id
                })

                return {
                    "redirect_url": response_data.get("next_redirect_pc_url"),
                }
            else:
                logger.error(f"Payment initiation failed: {response_data}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    # 정기 결제 승인 이후 `UserSubscription` 업데이트
    def approve_payment(self, pg_token: str, db: Session):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        payment_info = self.get_cache()

        if not payment_info:
            logger.error("Failed to retrieve payment information from cache.")
            raise HTTPException(status_code=404, detail="Payment information not found in cache")

        try:
            logger.info(f"Retrieved payment information from cache: {payment_info}")
            
            data = {
                "cid": payment_info["cid"],
                "tid": payment_info["tid"],
                "partner_order_id": payment_info["partner_order_id"],
                "partner_user_id": payment_info["partner_user_id"],
                "pg_token": pg_token,
            }

            response = requests.post(f"{self.base_url}/approve", headers=headers, json=data)
            response_data = response.json()

            # response_data 출력
            logger.info(f"Response data from payment approval: {response_data}")

            if response.status_code == 200:
                payment = db.query(Payment).filter(Payment.payment_number == payment_info["tid"]).first()
                if payment:
                    payment.status = "SUCCESS"
                    payment.transaction_number = response_data.get("aid")
                    payment.payment_date = response_data.get("approved_at")
                    db.commit()

                    logger.info(f"Payment subscription_id: {payment.subscription_id}")

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
                        
                return KakaoPayApproval(**response_data)
            else:
                logger.error(f"Payment approval failed with response: {response_data}")
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except Exception as e:
            logger.error(f"Exception occurred during payment approval process: {str(e)}")
            raise HTTPException(status_code=400, detail="An error occurred while processing the payment approval.")
        
    def initiate_subscription(self, subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # 기존 활성 구독이 있는지 확인
        existing_subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == subscription_request.partner_user_id,
            UserSubscription.status == 'ACTIVE'
        ).first()
        
        if existing_subscription:
            raise HTTPException(status_code=400, detail="User already has an active subscription.")

        # 구독 플랜 확인
        subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == subscription_request.plan_id).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Invalid subscription plan")

        # 새 partner_order_id 생성
        partner_order_id = f"{uuid.uuid4()}"

        # `UserSubscription` 레코드 생성 (start_date, next_billing_date, status는 NULL로)
        new_subscription = UserSubscription(
            user_id=subscription_request.partner_user_id,
            plan_id=subscription_plan.plan_id,
            start_date=datetime.now().date(),  # 기본값: 현재 날짜
            next_billing_date=(datetime.now() + timedelta(days=30)).date(),  # 기본값: 30일 뒤
            status='CANCELLED',
            subscription_number=None  # 실제 결제 완료 후 이 값을 업데이트할 수 있습니다.
        )
        db.add(new_subscription)
        db.commit()
        db.refresh(new_subscription)

        # 결제 준비 데이터
        data = {
            "cid": self.cid_sub,
            "partner_order_id": partner_order_id,
            "partner_user_id": subscription_request.partner_user_id,
            "item_name": subscription_plan.plan_name,
            "quantity": 1,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": "http://localhost:8000/v1/pay/success",
            "cancel_url": "http://localhost:8000/v1/pay/cancel",
            "fail_url": "http://localhost:8000/v1/pay/fail",
        }

        response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
        response_data = response.json()

        if response.status_code == 200:
            tid = response_data.get("tid")
            
            # `Payment` 테이블에 결제 정보 저장 (생성한 `subscription_id`와 함께)
            payment = Payment(
                payment_id=partner_order_id,
                user_id=subscription_request.partner_user_id,
                subscription_id=new_subscription.subscription_id,  # 새로 생성한 subscription_id 저장
                payment_number=tid,
                amount=float(subscription_plan.price),
                payment_method="KakaoPay_subscription",
                payment_date=datetime.now(),
                used_coupon_id=getattr(subscription_request, 'coupon_id', None),
                status="FAILED"
            )
            logger.info(f"payment 객체: {payment}")
            try:
                db.add(payment)
                db.commit()
            except IntegrityError as e:
                logger.error(f"결제 정보 삽입 중 IntegrityError 발생: {e}")
                db.rollback()
                raise HTTPException(status_code=500, detail="결제 정보를 저장하는 중 문제가 발생했습니다.")
            except Exception as e:
                logger.error(f"결제 정보 삽입 중 예외 발생: {e}")
                db.rollback()
                raise HTTPException(status_code=400, detail="결제 정보를 저장하는 중 문제가 발생했습니다.")

            # 결제 관련 정보 캐시에 저장
            self.set_cache({
                "cid": self.cid_sub,
                "tid": tid,
                "partner_order_id": partner_order_id,
                "partner_user_id": subscription_request.partner_user_id
            })

            return {
                "redirect_url": response_data.get("next_redirect_pc_url"),
            }
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

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
        
    def process_refund(self, tid: str, db: Session = Depends(get_db)):
        # Fetch payment details from the database
        payment = db.query(Payment).filter(Payment.payment_number == tid).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found or unauthorized request")

        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # Prepare the data for processing a refund
        data = {
            "cid": self.cid_one,
            "tid": tid,
            "cancel_amount": payment.amount,
            "cancel_tax_free_amount": 0,
        }

        response = requests.post(f"{self.base_url}/cancel", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            refund = Refund(
                payment_id=payment.payment_id,
                user_id=payment.user_id,
                amount=payment.amount,
                reason="User requested refund",  # You can add more context here if needed
                status="APPROVED",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            payment.status = "CANCEL_PAYMENT"
            db.add(refund)
            db.commit()
            return refund
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))
