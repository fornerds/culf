import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePayment } from '@/hooks/payment/usePayment';
import styles from './Payment.module.css';
import logoGray from '@/assets/images/culf_gray.png';
import { Checkbox } from '@/components/atom/Checkbox';
import { InputBox } from '@/components/molecule/InputBox';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';
import { usePortoneInit } from '@/hooks/payment/usePortoneInit';
import { Popup } from '@/components/molecule';

interface PaymentInfo {
  productPrice: number;
  monthlyDiscount: number;
  couponDiscount: number;
  totalPrice: number;
}

interface SubscriptionProduct {
  plan_id: number;
  plan_name: string;
  price: string;
  discounted_price: string;
  tokens_included: number;
  description: string;
  is_promotion: boolean;
  promotion_details: any;
  created_at: string;
  updated_at: string;
}

interface TokenProduct {
  token_plan_id: number;
  tokens: number;
  price: string;
  discounted_price: string;
  discount_rate: string;
  is_promotion: boolean;
  created_at: string;
  updated_at: string;
}

export function Payment() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const productType = type as 'subscription' | 'token';
  const isPortoneInitialized = usePortoneInit();
  
  // 상태 관리
  const [selectedPg, setSelectedPg] = useState('kakaopay');
  const [payMethod, setPayMethod] = useState('');
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

  // 커스텀 훅 사용
  const { 
    getProductById, 
    validateCoupon, 
    processSinglePayment,
    processSubscription,
    isLoading,
    pgProviders,
    payMethods,
    setErrorMessage,
    errorMessage,
    showErrorPopup,
    setShowErrorPopup
  } = usePayment();

  const { data: productData } = getProductById(id!, productType);

  // 타입 가드 함수
  const isSubscription = (data: any): data is SubscriptionProduct => {
    return 'plan_id' in data;
  };

  // Effects
  useEffect(() => {
    if (selectedPg === pgProviders.DANAL_TPAY) {
      setPayMethod(payMethods.CARD); // 기본값 설정
    } else {
      setPayMethod(''); // 다날 Tpay가 아닌 경우 초기화
    }
  }, [selectedPg, pgProviders.DANAL_TPAY, payMethods.CARD]);

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

  // 환경 감지 함수
  const detectEnvironment = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/android|iphone|ipad/i.test(userAgent)) return 'app';
    return 'pc';
  };

  // 쿠폰 관련 함수들
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

  // 결제 처리 함수
  const handlePaymentSubmit = async () => {
    if (!isPaymentEnabled) return;
    
    if (!isPortoneInitialized) {
      setErrorMessage('결제 시스템을 초기화하는 중입니다. 잠시만 기다려주세요.');
      setShowErrorPopup(true);
      return;
    }

    try {
      console.log('Payment submission started:', {
        productType,
        id,
        selectedPg,
        payMethod,
        couponCode
      });

      if (!id || !productData) {
        throw new Error('상품 정보가 올바르지 않습니다.');
      }

      // 결제 데이터 구성
      const paymentData = {
        plan_id: Number(id),
        pg: selectedPg,
        ...(selectedPg === pgProviders.DANAL_TPAY && { pay_method: payMethod }),
        ...(selectedPg === pgProviders.DANAL && { pay_method: 'phone' }),
        ...(isCouponApplied && couponCode && { coupon_code: couponCode })
      };

      console.log('Prepared payment data:', paymentData);

      // PG사별 특별 처리
      if (selectedPg === pgProviders.KAKAO && productType === 'subscription') {
        paymentData.pg = pgProviders.KAKAO_SUBSCRIPTION;
      }

      try {
        if (productType === 'subscription') {
          console.log('Processing subscription payment');
          await processSubscription(paymentData);
        } else {
          console.log('Processing single payment');
          await processSinglePayment(paymentData);
        }
      } catch (error: any) {
        console.error('Payment processing error:', error);
        const errorDetail = error.response?.data?.detail;
        setErrorMessage(errorDetail || error.message || '결제 처리 중 오류가 발생했습니다.');
        setShowErrorPopup(true);
      }
    } catch (error: any) {
      console.error('Payment submission error:', error);
      setErrorMessage(error.message || '결제 처리 중 오류가 발생했습니다.');
      setShowErrorPopup(true);
    }
  };
  

  // Validation 관련 함수들
  const getValidationMessage = () => {
    if (!showValidation) return undefined;
    return validationMessage;
  };

  const getValidationMessageType = () => {
    if (!showValidation) return undefined;
    return isCouponApplied ? 'success' : 'error';
  };

  const isPaymentEnabled = isAgreed;

  // 로딩 상태 처리
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

  return (<>
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

          {/* 상품 정보 섹션 */}
          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} font-card-title-1`}>
              상품 정보
            </h2>
            <div className={styles.infoRow}>
              <span className="font-text-4">상품명</span>
              <span className={`${styles.highlight} font-tag-1`}>
                {productData && (isSubscription(productData)
                  ? productData.plan_name
                  : `스톤 ${(productData as TokenProduct).tokens}개`)}
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

          {/* 쿠폰 섹션 */}
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

          {/* 결제 금액 섹션 */}
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

          <section className={styles.section2}>
            <h2 className={`${styles.sectionTitle} font-title-3`}>
              결제 수단 선택
            </h2>
            <div className={styles.paymentMethods}>
              <select 
                value={selectedPg}
                onChange={(e) => {
                  setSelectedPg(e.target.value);
                  // 다날 휴대폰 결제 선택 시 pay_method 자동 설정
                  if (e.target.value === pgProviders.DANAL) {
                    setPayMethod('phone');
                  }
                }}
                className={styles.select}
              >
                {productType === 'subscription' 
                ? <option value={pgProviders.KAKAO_SUBSCRIPTION}>카카오페이</option>
                : <option value={pgProviders.KAKAO}>카카오페이</option>}
                <option value={pgProviders.DANAL_TPAY}>다날 Tpay</option>
              </select>

              {selectedPg === pgProviders.DANAL_TPAY && (
                <select 
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className={styles.select}
                >
                  <option value={payMethods.CARD}>신용카드</option>
                  <option value={payMethods.TRANS}>실시간 계좌이체</option>
                  <option value={payMethods.VBANK}>가상계좌</option>
                </select>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 약관 동의 */}
      <Checkbox
        id="agreement"
        label="구매조건 확인 및 결제진행 동의"
        checked={isAgreed}
        onChange={(e) => setIsAgreed(e.target.checked)}
      />

      {/* 결제 버튼 */}
      <button
        disabled={!isPaymentEnabled}
        onClick={handlePaymentSubmit}
        className={`${styles.payButton} ${
          !isPaymentEnabled ? styles.disabled : ''
        } font-button-1`}
      >
        결제하기
      </button>
    </main>
    <Popup
        type="alert"
        isOpen={showErrorPopup}
        onClose={() => setShowErrorPopup(false)}
        content={errorMessage || '알 수 없는 오류가 발생했습니다.'}
        confirmText="확인"
      />
  </>
  );
}