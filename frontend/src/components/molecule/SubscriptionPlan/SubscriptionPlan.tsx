import { Tag } from '@/components/atom/Tag';
import styles from './SubscriptionPlan.module.css';
import { useNavigate } from 'react-router-dom';

import { Button, Link } from '@/components/atom';

interface SubscriptionPlanProps {
  subscription?: {
    subscription_id: number;
    plan_id: number;
    plan_name: string;
    price: string;
    start_date: string;
    next_billing_date: string;
    subscriptions_method: string;
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  };
  onCancelSubscription?: () => void;
}

export function SubscriptionPlan({ subscription, onCancelSubscription }: SubscriptionPlanProps) {
  const navigate = useNavigate();

  const convertToKoreanDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
  };

  if (!subscription || subscription.status !== 'ACTIVE') {
    return (
      <section className={styles.subscriptionPlanSection}>
        <div className={`${styles.sectionTop} font-card-title-1`}>
          구독 플랜
        </div>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateMessage}>
            {!subscription 
              ? '아직 구독 중인 서비스가 없습니다.' 
              : '현재 활성화된 구독이 없습니다.'
            }
          </p>
          <Button 
            size="size3" 
            onClick={() => navigate('/pricing')}
          >
            구독 시작하기
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.subscriptionPlanSection}>
      <div className={`${styles.sectionTop} font-card-title-1`}>
        현재 구독 플랜
      </div>
      <div className={styles.sectionInfo}>
        <Tag
          text={subscription.plan_name}
          variant="keycolor2"
        />
        <div>
          <span className="font-title-3">
            {subscription.price.toLocaleString()} 원
          </span>
          <span className="font-text-3"> /월</span>
          <div className={`${styles.textSub} font-text-4`}>
            다음 결제일은 {convertToKoreanDate(subscription.next_billing_date)}
            입니다.
          </div>
        </div>
      </div>
      <div className={styles.sectionBottom}>
        {onCancelSubscription && (
          <button 
            className={styles.textButton}
            onClick={onCancelSubscription}
          >
            구독 취소
          </button>
        )}
        <Button 
          size="size4" 
          onClick={() => navigate("/pricing")}
        >
          플랜 변경
        </Button>
      </div>
    </section>
  );
}