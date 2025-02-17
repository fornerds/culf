import { Button } from '@/components/atom';
import styles from './DeleteAccount.module.css';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/atom/Checkbox';
import { useUser } from '@/hooks/user/useUser';
import { useAuthStore } from '@/state/client/authStore';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Popup } from '@/components/molecule/Popup';
import { tokenService } from '@/utils/tokenService';
import { subscription } from '@/api';

interface DeleteReasonOption {
  id: string;
  label: string;
}

const DELETE_REASONS: DeleteReasonOption[] = [
  { id: '1', label: '사용을 잘 안해요' },
  { id: '2', label: '컨텐츠가 큰 도움이 안돼요' },
  { id: '3', label: '챗봇이 생각보다 별로에요' },
  { id: '4', label: '너무 비싸요' },
  { id: '5', label: '삭제해야하는 개인정보가 있어요' },
  { id: '6', label: '기타' },
] as const;

const OTHER_REASON_ID = '6';
const MAX_FEEDBACK_LENGTH = 1000;

export function DeleteAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { deleteAccount, isLoading } = useUser();
  const { logout } = useAuthStore();
  
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isOtherReasonSelected = selectedReasons.includes(OTHER_REASON_ID);
  const hasSelectedReasons = selectedReasons.length > 0;

  // 구독 정보 조회
  const { data: subscriptionInfo } = useQuery({
    queryKey: ['subscriptionInfo'],
    queryFn: async () => {
      const response = await subscription.getMySubscription();
      return response.data;
    },
    staleTime: 0
  });

  const handleReasonChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = e.target;
    
    setSelectedReasons(prev => {
      const newReasons = checked 
        ? [...prev, id]
        : prev.filter(reasonId => reasonId !== id);

      if (id === OTHER_REASON_ID && !checked) {
        setFeedback('');
      }

      return newReasons;
    });

    setError(null);
  };

  const handleFeedbackChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setFeedback(e.target.value);
    setError(null);
  };

  const handleDeleteAccount = async () => {
    if (!hasSelectedReasons) {
      setError('탈퇴 사유를 1개 이상 선택해주세요.');
      return;
    }

    // 활성 구독이 있는지 확인
    const hasActiveSubscription = subscriptionInfo?.some(sub => sub.status === 'ACTIVE');
    
    if (hasActiveSubscription) {
      setShowSubscriptionPopup(true);
      return;
    }

    await processDeleteAccount();
  };

  const processDeleteAccount = async () => {
    try {
      const reasons = selectedReasons
        .map(id => DELETE_REASONS.find(reason => reason.id === id)?.label)
        .filter(Boolean)
        .join(', ');

      const feedbackText = isOtherReasonSelected ? feedback : '';

      await deleteAccount(reasons, feedbackText);
      
      setShowCompletePopup(true);
    } catch (err) {
      setError('회원탈퇴 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Delete account error:', err);
    }
  };

  const handlePopupClose = () => {
    tokenService.removeAccessToken();
    queryClient.clear();
    logout();
    navigate('/login', { replace: true });
  };

  const handleSubscriptionPopupConfirm = () => {
    navigate('/mypage/payment');
  };

  const handleCancel = () => {
    navigate(-1);
  };

  useEffect(() => {
    if (isOtherReasonSelected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOtherReasonSelected]);

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-3">
          앗! 떠나시려구요..?
          <br />
          불편한점이 있으셨나봐요.
        </div>
        
        <div className={`${styles.textSub} font-text-3`}>
          저희에게 알려주시면 더욱 나아진 모습이 되겠습니다.
        </div>
        
        <div className={styles.formWrapper}>
          {DELETE_REASONS.map((reason) => (
            <Checkbox
              key={reason.id}
              id={reason.id}
              label={reason.label}
              checked={selectedReasons.includes(reason.id)}
              onChange={handleReasonChange}
              disabled={isLoading}
            />
          ))}
          
          <textarea
            ref={textareaRef}
            id="feedback"
            value={feedback}
            onChange={handleFeedbackChange}
            placeholder="내용을 입력해주세요"
            disabled={!isOtherReasonSelected || isLoading}
            className={`${styles.textarea} ${
              !isOtherReasonSelected && styles.disabled
            } font-guidetext`}
            maxLength={MAX_FEEDBACK_LENGTH}
            rows={1}
          />
          
          {error && (
            <div className={`${styles.error} font-text-3`} role="alert">
              {error}
            </div>
          )}
        </div>
        
        <div className={styles.bottom}>
          <div className="font-text-3">
            탈퇴하시면 그동안 결제한 서비스는 더이상 이용하지 못합니다. 그래도
            탈퇴하시겠어요?
          </div>
          
          <div className={styles.buttonGroup}>
            <Button
              size="size3"
              variant="warning"
              className={!hasSelectedReasons ? `${styles.button} ${styles.textSub}` : ''}
              onClick={handleDeleteAccount}
              disabled={isLoading || !hasSelectedReasons}
            >
              {isLoading ? '처리중...' : '예, 탈퇴할게요'}
            </Button>
            
            <Button
              size="size3"
              variant="less-highlight"
              onClick={handleCancel}
              disabled={isLoading}
            >
              아니오
            </Button>
          </div>
        </div>
      </main>

      <Popup
        type="alert"
        isOpen={showCompletePopup}
        onClose={handlePopupClose}
        content="탈퇴가 완료되었습니다."
        confirmText="확인"
      />

      <Popup
        type="confirm"
        isOpen={showSubscriptionPopup}
        onClose={() => setShowSubscriptionPopup(false)}
        onConfirm={handleSubscriptionPopupConfirm}
        content="현재 구독중인 상품이 있습니다. 회원 탈퇴 전에 상품 구독을 취소하시겠습니까?"
        confirmText="예"
        cancelText="아니오"
      />
    </>
  );
}