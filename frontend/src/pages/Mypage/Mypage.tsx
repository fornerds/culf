import { Header } from '@/components/organism';
import styles from './Mypage.module.css';
import { Tab } from '@/modules';
import { Account, Subscription, PaymentHistory } from '@/components/organism';
import { useNavigate, useParams } from 'react-router-dom';

export function Mypage() {
  const { tab } = useParams();
  const navigate = useNavigate();

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

  return (
    <>
      <div className={styles.userInfo}>
        <div className="font-text-3">
          <span className="font-title-3">컬프랜드</span> 님
        </div>
        <div className="font-tag-1">
          잔여 토큰
          <span className={`font-text-2 ${styles.userToken}`}>12</span>개
        </div>
      </div>

      <Tab
        tabs={tabs}
        defaultActiveTab={tab}
        onClickTab={(tabId) => navigate(`/mypage/${tabId}`, { replace: true })}
      />
    </>
  );
}
