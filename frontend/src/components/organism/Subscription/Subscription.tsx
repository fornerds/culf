import { useNavigate } from 'react-router-dom';
import styles from './Subscription.module.css';
import { Button } from '@/components/atom';
import { SubscriptionPlan } from '@/components/molecule/SubscriptionPlan';
import { BillingListItem } from '@/components/molecule/BillingListItem';
import { useCancelSubscription } from '@/state/server/paymentQueries';
import { useUser } from '@/hooks/user/useUser';
import { useState } from 'react';
import { Popup } from '@/components/molecule/Popup';

export function Subscription() {
  const navigate = useNavigate();
  const { getUserInfo: { data: userInfo, isLoading, error }, updateUserInfo } = useUser();
  const cancelSubscriptionMutation = useCancelSubscription();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [nameValidation, setNameValidation] = useState<{ message: string; type: 'error' | 'success' }>();

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscriptionMutation.mutateAsync();
      navigate('/pricing');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const handleUpdateUserInfo = async (formData: { name: string; email: string }) => {
    try {
      if (!formData.name.trim()) {
        setNameValidation({ message: '이름을 입력해주세요', type: 'error' });
        return false;
      }

      await updateUserInfo({ nickname: formData.name });
      setNameValidation({ message: '이름이 변경되었습니다', type: 'success' });
      return true;
    } catch (error) {
      setNameValidation({ message: '이름 변경에 실패했습니다', type: 'error' });
      return false;
    }
  };

  if (isLoading) return <div>Loading...</div>;

  if (error) {
    return <div className="text-red-500">정보를 불러오는데 실패했습니다.</div>;
  }

  return (
    <main className={styles.main}>
      <SubscriptionPlan 
        subscription={userInfo?.subscription}
        onCancelSubscription={handleCancelSubscription}
      />
      
      <section>
        <div className={styles.sectionTitle}>
          <span className="font-card-title-1">청구 정보</span>
          <button 
            className={styles.textButton}
            onClick={() => setIsPopupOpen(true)}
          >
            정보 수정
          </button>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userInfoItem}>
            <div className="font-text-3">이름</div>
            <div className="font-text-2">{userInfo?.nickname}</div>
          </div>
          <div className={styles.userInfoItem}>
            <div className="font-text-3">이메일</div>
            <div className="font-text-2">{userInfo?.email}</div>
          </div>
        </div>
      </section>
      
      {userInfo?.subscription && (
        <section>
          <div className={styles.sectionTitle}>
            <span className="font-card-title-1">청구 내역</span>
          </div>
          <div className={styles.billingList}>
            <div className="text-center py-4 text-gray-500">
              아직 결제 내역이 없습니다.
            </div>
          </div>
        </section>
      )}

      <Popup
        type="form"
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title="청구 정보 수정"
        onSubmit={handleUpdateUserInfo}
        initialData={{
          name: userInfo?.nickname || '',
          email: userInfo?.email || ''
        }}
        nameValidation={nameValidation}
        submitText="저장"
      />
    </main>
  );
}