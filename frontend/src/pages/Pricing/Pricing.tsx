import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PriceCard } from '@/components/molecule';
import { usePayment } from '@/hooks/payment/usePayment';
import { useUser } from '@/hooks/user/useUser';
import EditIcon from '@/assets/icons/edit.svg?react';
import styles from './Pricing.module.css';

interface SelectedPlan {
  type: 'subscription' | 'token';
  id: number;
}

export function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const navigate = useNavigate();
  const { getProducts, isLoading } = usePayment();
  const { getTokenInfo } = useUser();
  const { data: products } = getProducts;
  const { data: tokenData } = getTokenInfo;

  function handleSelect(type: 'subscription' | 'token', id: number) {
    if (selectedPlan?.id === id && selectedPlan?.type === type) {
      setSelectedPlan(null);
    } else {
      setSelectedPlan({ type, id });
    }
  }

  function handlePayment() {
    if (!selectedPlan) return;
    const paymentPath = `/payment/${selectedPlan.type}/${selectedPlan.id}`;
    navigate(paymentPath);
  }

  const remainingTokens = tokenData?.total_tokens || 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-96">로딩중...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={`${styles.sectionTitle} font-title-2`}>
        <p>스톤을 구매해</p>
        <p>AI 캐릭터들과 대화해보세요.</p>
      </h2>

      <div className={styles.section}>
        <h3 className="font-card-title-2">구독 결제</h3>
        {products?.subscription_plans.map((plan) => (
          <PriceCard
            key={plan.plan_id}
            type="subscription"
            title={plan.plan_name}
            subtitle={plan.description}
            originalPrice={Number(plan.price)}
            finalPrice={Number(plan.discounted_price)}
            discountPercentage={
              ((Number(plan.price) - Number(plan.discounted_price)) /
                Number(plan.price)) *
              100
            }
            isSelected={
              selectedPlan?.type === 'subscription' &&
              selectedPlan?.id === plan.plan_id
            }
            onClick={() => handleSelect('subscription', plan.plan_id)}
          />
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.tokenHeader}>
          <h3 className="font-card-title-2">스톤 결제</h3>
          <span className={styles.tokenCount}>보유 스톤 {remainingTokens}개</span>
        </div>
        <div className={styles.cardGrid}>
          {products?.token_plans.map((plan) => (
            <PriceCard
              key={plan.token_plan_id}
              type="token"
              title={`스톤 ${plan.tokens}개`}
              originalPrice={Number(plan.price)}
              finalPrice={Number(plan.discounted_price)}
              discountPercentage={Number(plan.discount_rate)}
              isSelected={
                selectedPlan?.type === 'token' &&
                selectedPlan?.id === plan.token_plan_id
              }
              onClick={() => handleSelect('token', plan.token_plan_id)}
            />
          ))}
        </div>
      </div>

      <button
        className={`${styles.button} ${
          selectedPlan ? styles.buttonEnabled : styles.buttonDisabled
        } font-button-1`}
        disabled={!selectedPlan}
        onClick={handlePayment}
      >
        결제하기
      </button>

      <div className={styles.inquirySection}>
        <h3 className="font-hero-banner-2">
          기업이신가요?
          <p className={`${styles.inquiryText} font-button-1`}>
            기업전용 서비스에 문의하세요
          </p>
        </h3>
        <button
          className={`${styles.inquiryButton} font-button-1`}
          onClick={() => navigate('/inquiry')}
        >
          <EditIcon />
          <span>문의하기</span>
        </button>
      </div>
    </div>
  );
}