import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePayment } from '@/hooks/payment/usePayment';
import styles from './Payment.module.css';
import logoGray from '@/assets/images/culf_gray.png';
import { Checkbox } from '@/components/atom/Checkbox';
import { InputBox } from '@/components/molecule/InputBox';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

interface PaymentInfo {
  productPrice: number;
  monthlyDiscount: number;
  couponDiscount: number;
  totalPrice: number;
}

interface PaymentMethod {
  id: 'creditcard' | 'virtualaccount' | 'bank' | 'phone' | 'kakaopay';
  label: string;
}

const paymentMethods: PaymentMethod[] = [
  { id: 'creditcard', label: '신용카드' },
  { id: 'virtualaccount', label: '가상계좌' },
  { id: 'bank', label: '무통장 입금' },
  { id: 'phone', label: '핸드폰 결제' },
  { id: 'kakaopay', label: '카카오페이' },
];

export function Payment() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const productType = type as 'subscription' | 'token';
  
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod['id'] | ''>('kakaopay');
  const [isAgreed, setIsAgreed] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    productPrice: 0,
    monthlyDiscount: 0,
    couponDiscount: 0,
    totalPrice: 0,
  });

  const { 
    getProductById, 
    validateCoupon, 
    processSinglePayment,
    processSubscription,
    isLoading 
  } = usePayment();

  const { data: productData } = getProductById(id!, productType);

  const isSubscription = (data: any): data is SubscriptionProduct => {
    return 'plan_id' in data;
  };

  useEffect(() => {
    if (productData) {
      const price = Number(productData.price);
      const discountedPrice = Number(productData.discounted_price);
      const discount = price - discountedPrice;

      setPaymentInfo({
        productPrice: price,
        monthlyDiscount: discount,
        couponDiscount: 0,
        totalPrice: discountedPrice,
      });
    }
  }, [productData]);

  const detectEnvironment = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/android|iphone|ipad/i.test(userAgent)) return 'app';
    return 'pc';
  };

  const handleCouponChange = (value: string) => {
    setCouponCode(value);
    setShowValidation(false);
    if (isCouponApplied) {
      setIsCouponApplied(false);
      setPaymentInfo(prev => ({
        ...prev,
        couponDiscount: 0,
        totalPrice: prev.totalPrice + prev.couponDiscount,
      }));
    }
  };

  const handleCouponApply = async () => {
    try {
      console.log('Attempting to apply coupon:', couponCode);
      const response = await validateCoupon(couponCode);
      console.log('Coupon application response:', response);
      
      setShowValidation(true);
  
      if (response.is_valid) {
        console.log('Coupon is valid, applying discount:', response.discount_value);
        setIsCouponApplied(true);
        setValidationMessage('쿠폰이 성공적으로 적용되었습니다.');
        
        if (response.discount_value) {
          const newDiscount = response.discount_value;
          setPaymentInfo(prev => {
            const newTotal = Math.max(0, prev.totalPrice - newDiscount);
            console.log('Updating payment info:', {
              oldTotal: prev.totalPrice,
              discount: newDiscount,
              newTotal: newTotal
            });
            return {
              ...prev,
              couponDiscount: newDiscount,
              totalPrice: newTotal
            };
          });
        }
      } else {
        console.log('Coupon is invalid:', response.message);
        setIsCouponApplied(false);
        setValidationMessage(response.message || '유효하지 않은 쿠폰입니다.');
      }
    } catch (error: any) {
      console.error('Coupon application error:', {
        message: error.message,
        details: error.response?.data
      });
      setShowValidation(true);
      setValidationMessage('쿠폰 적용 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsCouponApplied(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!isPaymentEnabled) return;
  
    try {
      if (!id || !productData) {
        throw new Error('상품 정보가 올바르지 않습니다.');
      }
  
      // 결제 데이터 준비
      let paymentData;
      if (productType === 'subscription') {
        paymentData = {
          plan_id: Number(id),
          quantity: 1,
          environment: detectEnvironment(),
          coupon_code: isCouponApplied && couponCode ? couponCode : undefined
        };
      } else {
        // 토큰 결제의 경우
        paymentData = {
          plan_id: Number(id), // URL의 id 파라미터 사용
          quantity: 1,
          environment: detectEnvironment(),
          coupon_code: isCouponApplied && couponCode ? couponCode : undefined
        };
      }
  
      console.log('Payment request data:', paymentData);
  
      try {
        if (productType === 'subscription') {
          await processSubscription(paymentData);
        } else {
          await processSinglePayment(paymentData);
        }
      } catch (error: any) {
        if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      alert(error.message || '결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const getValidationMessage = () => {
    if (!showValidation) return undefined;
    return validationMessage;
  };

  const getValidationMessageType = () => {
    if (!showValidation) return undefined;
    return isCouponApplied ? 'success' : 'error';
  };

  const isPaymentEnabled = isAgreed;

  if (isLoading) {
    return (
      <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200} 
        />
        <p className='font-tag-1' style={{color: "#a1a1a1"}}>로딩 중</p>
      </div>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.cardWrapper}>
        <div
          className={styles.cardBackground}
          style={{
            backgroundColor: '#FBFBFB',
            border: '1px solid #DADDE0',
          }}
        />
        <div className={styles.card}>
          <img
            className={styles.img}
            src={logoGray}
            alt="로고이미지"
            width="42px"
            height="15px"
          />

          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} font-card-title-1`}>
              상품 정보
            </h2>
            <div className={styles.infoRow}>
              <span className="font-text-4">상품명</span>
              <span className={`${styles.highlight} font-tag-1`}>
                {productData && (isSubscription(productData)
                  ? productData.plan_name
                  : `토큰 ${(productData as TokenProduct).tokens}개`)}
              </span>
            </div>
            {type === 'subscription' && (
              <div className={styles.infoRow}>
                <span className="font-text-4">다음 결제일</span>
                <span className="font-tag-1">
                  {new Date(
                    new Date().setMonth(new Date().getMonth() + 1)
                  ).toISOString().split('T')[0]}
                </span>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} font-card-title-1`}>
              쿠폰 사용
            </h2>
            <InputBox
              value={couponCode}
              placeholder="쿠폰 번호 입력"
              inputDisabled={isCouponApplied}
              buttonSize="size4"
              buttonVariant={
                !couponCode || isCouponApplied ? 'disable' : 'default'
              }
              buttonDisabled={!couponCode || isCouponApplied}
              buttonText="쿠폰 사용하기"
              validationMessage={getValidationMessage()}
              validationMessageType={getValidationMessageType()}
              onChange={handleCouponChange}
              onClick={handleCouponApply}
            />
          </section>

          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} font-card-title-1`}>
              결제 금액
            </h2>
            <div className={styles.priceInfo}>
              <div className={styles.priceRow}>
                <span className="font-text-4">상품가격</span>
                <span className="font-tag-1">
                  {paymentInfo.productPrice.toLocaleString()}원
                </span>
              </div>
              <div className={styles.priceRow}>
                <span className="font-text-4">일반 할인</span>
                <span className="font-tag-1">
                  -{paymentInfo.monthlyDiscount.toLocaleString()}원
                </span>
              </div>
              {isCouponApplied && (
                <div className={styles.priceRow}>
                  <span className="font-text-4">쿠폰 할인</span>
                  <span className="font-tag-1">
                    -{paymentInfo.couponDiscount.toLocaleString()}원
                  </span>
                </div>
              )}
              <div className={styles.totalPrice}>
                <span className="font-text-2">총 결제 금액</span>
                <span className={`${styles.highlight} font-card-title-1`}>
                  {paymentInfo.totalPrice.toLocaleString()}원
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Checkbox
        id="agreement"
        label="구매조건 확인 및 결제진행 동의"
        checked={isAgreed}
        onChange={(e) => setIsAgreed(e.target.checked)}
      />

      <button
        disabled={!isPaymentEnabled}
        onClick={handlePaymentSubmit}
        className={`${styles.payButton} ${
          !isPaymentEnabled ? styles.disabled : ''
        } font-button-1`}
      >
        카카오페이 결제하기
      </button>
    </main>
  );
}