import requests
import os
from datetime import datetime
from models import Payment, Refund, Coupon
from ..subscription.models import SubscriptionPlan, UserSubscription
from schemas import KakaoPayRequest, KakaoPayApproval, KakaoPayRefundRequest, KakaoPaySubscriptionRequest
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from sqlalchemy.exc import IntegrityError

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

    def initiate_payment(self, payment_request: KakaoPayRequest, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }

        # 구독 플랜 정보를 가져와 결제 정보에 반영
        subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == payment_request.plan_id).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Invalid subscription plan")

        coupon = None
        if payment_request.coupon_id:
            # 쿠폰 사용 처리
            coupon = db.query(Coupon).filter(Coupon.coupon_id == payment_request.coupon_id).with_for_update().first()
            if not coupon:
                raise HTTPException(status_code=404, detail="Invalid coupon")
            if coupon.max_usage is not None and coupon.used_count >= coupon.max_usage:
                raise HTTPException(status_code=400, detail="Coupon has reached its maximum usage limit")

            # 쿠폰 사용 횟수 증가 (트랜잭션 처리 내에서 안전하게 처리)
            coupon.used_count += 1
            db.add(coupon)

        # 결제 요청 데이터 생성
        data = {
            "cid": self.cid_one,
            "partner_order_id": payment_request.partner_order_id,
            "partner_user_id": payment_request.partner_user_id,
            "item_name": subscription_plan.plan_name,
            "quantity": payment_request.quantity,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": "http://localhost:8000/pay/success",
            "cancel_url": "http://localhost:8000/pay/cancel",
            "fail_url": "http://localhost:8000/pay/fail",
        }

        try:
            # 결제 요청 보내기
            response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
            response_data = response.json()

            if response.status_code == 200:
                # 결제 트랜잭션 커밋
                tid = response_data.get("tid")
                payment = Payment(
                    user_id=payment_request.user_id,
                    payment_number=tid,
                    amount=float(subscription_plan.price),
                    payment_method="KakaoPay_OneTime",
                    payment_date=datetime.now(),
                    status="FAILED",
                    used_coupon_id=payment_request.coupon_id if coupon else None,
                )
                db.add(payment)
                db.commit()
                return response_data.get("next_redirect_pc_url")
            else:
                raise HTTPException(status_code=400, detail=response_data.get("msg"))

        except IntegrityError:
            # 트랜잭션 처리 중 문제가 발생한 경우 롤백합니다.
            db.rollback()
            raise HTTPException(status_code=500, detail="Transaction failed. Please try again later.")

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    def approve_payment(self, pg_token: str, tid: str, db: Session = Depends(get_db), payment_type: str = "one_time"):
        """
        결제 승인 함수
        :param pg_token: 카카오페이에서 받은 pg_token
        :param tid: 결제 고유번호
        :param db: 데이터베이스 세션
        :param payment_type: 결제 타입 ('one_time' 또는 'subscription')
        """
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        
        # Set CID based on the payment type
        if payment_type == "subscription":
            cid = self.cid_seq  # Use CID for subscription payments (TCSEQUENCE)
        else:
            cid = self.cid_one  # Use CID for one-time payments (TC0ONETIME)

        # Prepare the data for approving a payment
        data = {
            "cid": cid,
            "tid": tid,
            "partner_order_id": "partner_order_id",
            "partner_user_id": "partner_user_id",
            "pg_token": pg_token,
        }

        response = requests.post(f"{self.base_url}/approve", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            payment = db.query(Payment).filter(Payment.payment_number == tid).first()
            payment.status = "SUCCESS"
            db.commit()
            return KakaoPayApproval(**response_data)
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))
        
    def initiate_subscription(self, subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        # Fetch subscription plan details from the database
        subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == subscription_request.plan_id).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Invalid subscription plan")

        # Prepare the data for initiating a subscription
        data = {
            "cid": self.cid_sub,
            "partner_order_id": subscription_request.partner_order_id,
            "partner_user_id": subscription_request.partner_user_id,
            "item_name": subscription_plan.plan_name,
            "quantity": subscription_request.quantity,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
            "approval_url": "http://localhost:8000/subscription/success",
            "cancel_url": "http://localhost:8000/subscription/cancel",
            "fail_url": "http://localhost:8000/subscription/fail",
        }
        response = requests.post(f"{self.base_url}/ready", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            return response_data.get("sid")
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    def process_refund(self, refund_request: KakaoPayRefundRequest, db: Session = Depends(get_db)):
        # Fetch payment details from the database
        payment = db.query(Payment).filter(Payment.payment_id == refund_request.payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        # Prepare the data for processing a refund
        data = {
            "cid": self.cid_one,
            "tid": payment.payment_number,
            "cancel_amount": refund_request.amount,
            "cancel_tax_free_amount": 0,
        }

        response = requests.post(f"{self.base_url}/cancel", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            refund = Refund(
                payment_id=payment.payment_id,
                user_id=payment.user_id,
                amount=refund_request.amount,
                reason=refund_request.reason,
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

    def pay_subscription(self, subscription_request: KakaoPaySubscriptionRequest, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        # Fetch subscription plan details from the database
        subscription_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == subscription_request.plan_id).first()
        if not subscription_plan:
            raise HTTPException(status_code=404, detail="Invalid subscription plan")

        # Prepare the data for paying a subscription
        data = {
            "cid": self.cid_sub,
            "sid": subscription_request.sid,
            "partner_order_id": subscription_request.partner_order_id,
            "partner_user_id": subscription_request.partner_user_id,
            "item_name": subscription_plan.plan_name,
            "quantity": subscription_request.quantity,
            "total_amount": float(subscription_plan.price),
            "vat_amount": 0,
            "tax_free_amount": 0,
        }
        response = requests.post(f"{self.base_url}/subscription", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            return response_data
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))
        
    def cancel_subscription(self, sid: str, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        # Prepare the data for canceling a subscription
        data = {
            "cid": self.cid_sub,
            "sid": sid,
        }
        response = requests.post(f"{self.base_url}/manage/subscription/inactive", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            return response_data
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))

    def get_subscription_status(self, sid: str, db: Session = Depends(get_db)):
        headers = {
            "Authorization": f"SECRET_KEY {self.secret_key}",
            "Content-Type": "application/json",
        }
        # Prepare the data for checking subscription status
        data = {
            "cid": self.cid_sub,
            "sid": sid,
        }
        response = requests.post(f"{self.base_url}/manage/subscription/status", headers=headers, json=data)
        response_data = response.json()

        # Handle the response from KakaoPay
        if response.status_code == 200:
            return response_data
        else:
            raise HTTPException(status_code=400, detail=response_data.get("msg"))