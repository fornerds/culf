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
import { RadioButton } from '@/components/atom/RadioButton';

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
  const [selectedMethod, setSelectedMethod] = useState<{
    pg: string;
    method: string;
  }>({ pg: 'kakaopay', method: '' });
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
    errorMessage,
    setErrorMessage,
    showErrorPopup,
    setShowErrorPopup
  } = usePayment();

  const { data: productData } = getProductById(id!, productType);

  const isSubscription = (data: any): data is SubscriptionProduct => {
    return 'plan_id' in data;
  };

  const paymentMethods = [
    {
      id: 'kakaopay',
      label: '카카오페이',
      pg: pgProviders.KAKAO,
      method: '',
      disabled: productType === 'subscription'
    },
    // {
    //   id: 'kakaopay_subscription',
    //   label: '카카오페이 정기결제',
    //   pg: pgProviders.KAKAO_SUBSCRIPTION,
    //   method: '',
    //   disabled: productType === 'token'
    // },
    {
      id: 'card',
      label: '신용카드',
      pg: pgProviders.DANAL_TPAY,
      method: payMethods.CARD,
      disabled: false
    },
    {
      id: 'trans',
      label: '실시간 계좌이체',
      pg: pgProviders.DANAL_TPAY,
      method: payMethods.TRANS,
      disabled: false
    },
    {
      id: 'vbank',
      label: '가상계좌',
      pg: pgProviders.DANAL_TPAY,
      method: payMethods.VBANK,
      disabled: false
    },
    {
      id: 'phone',
      label: '휴대폰 결제',
      pg: pgProviders.DANAL,
      method: payMethods.PHONE,
      disabled: productType === 'subscription'
    }
  ];

  // Effects
  useEffect(() => {
    if (productData) {
      const price = Number(productData.price);
      const discountedPrice = Number(productData.discounted_price);
      setPaymentInfo({
        productPrice: price,
        monthlyDiscount: price - discountedPrice,
        couponDiscount: 0,
        totalPrice: discountedPrice,
      });
    }
  }, [productData]);

  // Handlers
  const handlePaymentMethodChange = (id: string, checked: boolean) => {
    if (!checked) return;
    
    const selected = paymentMethods.find(method => method.id === id);
    if (selected) {
      setSelectedMethod({
        pg: selected.pg,
        method: selected.method
      });
    }
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
      const response = await validateCoupon(couponCode);
      setShowValidation(true);

      if (response.is_valid) {
        setIsCouponApplied(true);
        setValidationMessage('쿠폰이 성공적으로 적용되었습니다.');
        
        if (response.discount_value) {
          const newDiscount = response.discount_value;
          setPaymentInfo(prev => ({
            ...prev,
            couponDiscount: newDiscount,
            totalPrice: Math.max(0, prev.totalPrice - newDiscount)
          }));
        }
      } else {
        setIsCouponApplied(false);
        setValidationMessage(response.message || '유효하지 않은 쿠폰입니다.');
      }
    } catch (error: any) {
      setShowValidation(true);
      setValidationMessage('쿠폰 적용 중 오류가 발생했습니다.');
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
      const paymentData = {
        plan_id: Number(id),
        pg: selectedMethod.pg,
        pay_method: selectedMethod.method || undefined,
        ...(isCouponApplied && couponCode && { coupon_code: couponCode })
      };

      if (productType === 'subscription') {
        await processSubscription(paymentData);
      } else {
        await processSinglePayment(paymentData);
      }
    } catch (error: any) {
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

  const isPaymentEnabled = isAgreed && selectedMethod.pg;

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="로딩 이미지"
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

            {/* Product Information Section */}
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

            {/* Coupon Section */}
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

            {/* Payment Amount Section */}
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

            {/* Payment Method Section */}
            <section className={styles.section}>
              <h2 className={`${styles.sectionTitle} font-card-title-1`}>
                결제 수단 선택
              </h2>
              <div className={styles.paymentMethods}>
                {paymentMethods
                  .filter(method => !method.disabled)
                  .map((method) => (
                    <RadioButton
                      key={method.id}
                      id={method.id}
                      name="paymentMethod"
                      value={method.id}
                      label={method.label}
                      checked={selectedMethod.pg === method.pg && selectedMethod.method === method.method}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handlePaymentMethodChange(method.id, e.target.checked)
                      }
                    />
                  ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={`${styles.sectionTitle} font-card-title-1`}>
                서비스 제공 기간
              </h2>
              {type === 'subscription' ? <p className="font-text-4">매월 자동 결제 성공 즉시 다음 결제일까지 이용 가능</p> : <p className="font-text-4">상품 결제 시 즉시 지급</p>}
            </section>
          </div>
        </div>

        {/* Agreement Checkbox */}
        <Checkbox
          id="agreement"
          label="구매조건 확인 및 결제진행 동의"
          checked={isAgreed}
          onChange={(e) => setIsAgreed(e.target.checked)}
        />

        {/* Payment Button */}
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