import React, { useState } from 'react';
import styles from './Payment.module.css';
import logoGray from '@/assets/images/culf_gray.png';
import { Checkbox } from '@/components/atom/Checkbox';
import { InputBox } from '@/components/molecule/InputBox';

interface PaymentInfo {
  productPrice: number;
  monthlyDiscount: number;
  couponDiscount: number;
  totalPrice: number;
}

export function Payment() {
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const paymentMethods = [
    '신용카드',
    '가상계좌',
    '무통장 입금',
    '핸드폰 결제',
    '카카오페이',
  ];

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    productPrice: 20000,
    monthlyDiscount: 5000,
    couponDiscount: 0,
    totalPrice: 15000,
  });

  const handleCouponChange = (value: string) => {
    setCouponCode(value);
    setShowValidation(false);
  };

  const handleCouponApply = () => {
    setShowValidation(true);
    if (couponCode === '1111') {
      setIsCouponApplied(true);
      setPaymentInfo((prev) => ({
        ...prev,
        couponDiscount: 10000,
        totalPrice: prev.productPrice - prev.monthlyDiscount - 10000,
      }));
    }
  };

  const getValidationMessage = () => {
    if (!showValidation) return undefined;
    if (couponCode === '1111') return '쿠폰이 성공적으로 적용되었습니다.';
    return '유효하지 않은 쿠폰번호입니다.';
  };

  const getValidationMessageType = () => {
    if (!showValidation) return undefined;
    return couponCode === '1111' ? 'success' : 'error';
  };

  const isPaymentEnabled = selectedPayment !== '' && isAgreed;

  return (
    <main className={styles.main}>
      <div className={styles.cardWrapper}>
        <div
          className={styles.cardBackground}
          style={{
            backgroundColor: '#FBFBFB',
            border: '1px solid #DADDE0',
          }}
        ></div>
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
                토큰 정기 구독
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className="font-text-4">다음 결제일</span>
              <span className="font-tag-1">2025-07-10</span>
            </div>
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

      <section className={styles.section2}>
        <h2 className={`${styles.sectionTitle} font-title-3`}>결제 방법</h2>
        <div className={styles.paymentMethods}>
          {paymentMethods.map((method) => (
            <label key={method} className={styles.paymentMethod}>
              <input
                type="radio"
                name="payment"
                value={method}
                checked={selectedPayment === method}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className={styles.radio}
              />
              <span className="font-text-2">{method}</span>
            </label>
          ))}
        </div>
      </section>

      <Checkbox
        id="agreement"
        label="구매조건 확인 및 결제진행 동의"
        checked={isAgreed}
        onChange={(e) => setIsAgreed(e.target.checked)}
      />

      <button
        disabled={!isPaymentEnabled}
        className={`${styles.payButton} ${!isPaymentEnabled ? styles.disabled : ''} font-button-1`}
      >
        결제하기
      </button>
    </main>
  );
}
