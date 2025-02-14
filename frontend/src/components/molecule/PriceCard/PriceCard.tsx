import React from 'react';
import styles from './PriceCard.module.css';
import logoGray from '@/assets/images/culf_gray.png';
import logo from '@/assets/images/culf.png';

interface PriceOption {
  type: 'subscription' | 'stone';
  title: string;
  subtitle?: string;
  originalPrice: number;
  discountPercentage: number;
  finalPrice: number;
}

interface PriceCardProps extends PriceOption {
  isSelected: boolean;
  onClick: () => void;
}

export function PriceCard(props: PriceCardProps) {
  const {
    type,
    title,
    subtitle,
    originalPrice,
    discountPercentage,
    finalPrice,
    isSelected,
    onClick,
  } = props;

  const shouldShowDiscount = discountPercentage > 0;

  const roundedDiscountPercentage = Math.round(discountPercentage);

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.cardContent}>
        <div className={styles.headerWrap}>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h3 className="font-title-2">{title}</h3>
              {subtitle && (
                <p className={`${styles.subtitle} font-tag-2`}>{subtitle}</p>
              )}
            </div>
            <img
              src={isSelected ? logo : logoGray}
              alt="로고이미지"
              width="42px"
              height="15px"
            />
          </div>
          <div className={styles.priceSection}>
            {shouldShowDiscount ? (
              <div className={`${styles.discount} font-card-title-2`}>
                {roundedDiscountPercentage}% OFF
              </div>
            ): <div className={`${styles.discount} font-card-title-2`}></div>}
            <div>
              {originalPrice && (
                <p className={styles.originalPrice}>
                  {originalPrice.toLocaleString()}원
                </p>
              )}
              <p className="font-title-3">
                {finalPrice.toLocaleString()}원
                {type === 'subscription' ? '/월' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
