import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';
import styles from './Notification.module.css';
import { MyNotice, Notice } from '@/components/organism';
import { Tab } from '@/modules';

export function PublicNotification() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const tabs = [
    {
      id: 'notice',
      label: '공지사항',
      content: <Notice />,
    },
    ...(isAuthenticated ? [{
      id: 'my-notice',
      label: '내 알림',
      content: null, // 클릭 시 my-notice로 이동할 것이므로 content 불필요
    }] : []),
  ];

  return (
    <div className={styles.notification}>
      <Tab
        tabs={tabs}
        defaultActiveTab="notice"
        onClickTab={(tabId) => {
          if (tabId === 'my-notice') {
            navigate('/notification/my-notice');
          }
        }}
      />
    </div>
  );
}

export function PrivateNotification() {
  const navigate = useNavigate();

  const tabs = [
    {
      id: 'notice',
      label: '공지사항',
      content: null, // 클릭 시 notice로 이동할 것이므로 content 불필요
    },
    {
      id: 'my-notice',
      label: '내 알림',
      content: <MyNotice />,
    },
  ];

  return (
    <div className={styles.notification}>
      <Tab
        tabs={tabs}
        defaultActiveTab="my-notice"
        onClickTab={(tabId) => {
          if (tabId === 'notice') {
            navigate('/notification/notice');
          }
        }}
      />
    </div>
  );
}