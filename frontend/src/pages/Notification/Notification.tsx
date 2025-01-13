import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';
import styles from './Notification.module.css';
import { MyNotice, Notice } from '@/components/organism';
import { Tab } from '@/modules';
import { useEffect } from 'react';

export function Notification() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // 기본 탭을 'notice'로 설정하고 URL 파라미터가 없을 때 리다이렉트
  useEffect(() => {
    if (!tab) {
      navigate('/notification/notice', { replace: true });
    }
  }, [tab, navigate]);

  // 비로그인 사용자가 my-notice에 접근하면 notice로 리다이렉트
  useEffect(() => {
    if (!isAuthenticated && tab === 'my-notice') {
      navigate('/notification/notice', { replace: true });
    }
  }, [isAuthenticated, tab, navigate]);

  // 인증 상태에 따라 탭 구성
  const tabs = [
    {
      id: 'notice',
      label: '공지사항',
      content: <Notice />,
    },
    ...(isAuthenticated ? [{
      id: 'my-notice',
      label: '내 알림',
      content: <MyNotice />,
    }] : []),
  ];

  // tab이 undefined일 경우 'notice'를 기본값으로 사용
  const currentTab = tab || 'notice';

  return (
    <div className={styles.notification}>
      <Tab
        tabs={tabs}
        defaultActiveTab={currentTab}
        onClickTab={(tabId) => navigate(`/notification/${tabId}`)}
      />
    </div>
  );
}