import { Header } from '@/components/organism';
import styles from './Mypage.module.css';
import { Tab } from '@/modules';
import { Account, Subscription, PaymentHistory } from '@/components/organism';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '@/hooks/user/useUser';

export function Mypage() {
  const { tab = 'account' } = useParams();
  const navigate = useNavigate();
  
  const { 
    getUserInfo: { data: userInfo, isLoading: isUserLoading },
    getTokenInfo: { data: tokenInfo, isLoading: isTokenLoading }
  } = useUser();

  const tabs = [
    {
      id: 'account',
      label: '계정 관리',
      content: <Account />,
    },
    {
      id: 'subscription',
      label: '구독 관리',
      content: <Subscription />,
    },
    {
      id: 'payment',
      label: '결제 내역',
      content: <PaymentHistory />,
    },
  ];

  if (isUserLoading || isTokenLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className={styles.userInfo}>
        <div className="font-text-3">
          <span className="font-title-3">{userInfo?.nickname || '사용자'}</span> 님
        </div>
        <div className="font-tag-1">
          잔여 스톤
          <span className={`font-text-2 ${styles.userToken}`}>
            {tokenInfo?.total_tokens || 0}
          </span>개
        </div>
      </div>

      <Tab
        tabs={tabs}
        activeTab={tab}
        onClickTab={(tabId) => navigate(`/mypage/${tabId}`, { replace: true })}
      />
    </>
  );
}