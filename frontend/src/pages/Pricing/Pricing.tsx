import React, { useState } from 'react';
import { PriceCard } from '@/components/molecule';
import styles from './Pricing.module.css';
import EditIcon from '@/assets/icons/edit.svg?react';
import { useNavigate } from 'react-router-dom';

interface PriceOption {
  type: 'subscription' | 'token';
  title: string;
  subtitle?: string;
  originalPrice: number;
  discountPercentage: number;
  finalPrice: number;
}

export function Pricing() {
  const [selectedOption, setSelectedOption] = useState<PriceOption | null>(
    null,
  );

  const navigate = useNavigate();

  function getSubscriptionOption(): PriceOption {
    return {
      type: 'subscription',
      title: '정기 구독',
      subtitle: '정기구독에 관한 설명을 첨부합니다.',
      originalPrice: 20000,
      discountPercentage: 25,
      finalPrice: 15000,
    };
  }

  function getTokenOptions(): PriceOption[] {
    return [
      {
        type: 'token',
        title: '토큰 50개',
        originalPrice: 5000,
        discountPercentage: 20,
        finalPrice: 4000,
      },
      {
        type: 'token',
        title: '토큰 100개',
        originalPrice: 10000,
        discountPercentage: 25,
        finalPrice: 7500,
      },
      {
        type: 'token',
        title: '토큰 200개',
        originalPrice: 20000,
        discountPercentage: 40,
        finalPrice: 12000,
      },
    ];
  }

  function handleSelect(option: PriceOption): void {
    if (selectedOption?.title === option.title) {
      setSelectedOption(null);
    } else {
      setSelectedOption(option);
    }
  }

  function handlePayment(): void {
    if (selectedOption) {
      // 결제 처리 로직
      console.log('Selected option:', selectedOption);
    }
  }

  function renderSubscriptionSection() {
    const subscriptionOption = getSubscriptionOption();
    return (
      <div className={styles.section}>
        <h3 className="font-card-title-2">구독 결제</h3>
        <PriceCard
          {...subscriptionOption}
          isSelected={selectedOption?.title === subscriptionOption.title}
          onClick={() => handleSelect(subscriptionOption)}
        />
      </div>
    );
  }

  function renderTokenSection() {
    const tokenOptions = getTokenOptions();
    return (
      <div className={styles.section}>
        <div className={styles.tokenHeader}>
          <h3 className="font-card-title-2">토큰 결제</h3>
          <span className={styles.tokenCount}>보유 토큰 12개</span>
        </div>
        <div className={styles.cardGrid}>
          {tokenOptions.map((option) => (
            <PriceCard
              key={option.title}
              {...option}
              isSelected={selectedOption?.title === option.title}
              onClick={() => handleSelect(option)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderInquirySection() {
    return (
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
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={`${styles.sectionTitle} font-title-2`}>
        <p>토큰🪙을 구매해</p>
        <p>AI큐레이터들과 대화해보세요.</p>
      </h2>

      {renderSubscriptionSection()}
      {renderTokenSection()}

      <button
        className={`${styles.button} ${
          selectedOption ? styles.buttonEnabled : styles.buttonDisabled
        } font-button-1`}
        disabled={!selectedOption}
        onClick={() => navigate('/payment')}
      >
        결제하기
      </button>

      {renderInquirySection()}
    </div>
  );
}
