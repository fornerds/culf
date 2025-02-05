import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';
import styles from './Notification.module.css';
import { MyNotice, Notice } from '@/components/organism';
import { Tab } from '@/modules';

export const PublicNotification = () => {
  console.log('PublicNotification Rendering');
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
      content: null,
    }] : []),
  ];

  console.log('PublicNotification Tabs:', tabs);

  return (
    <div className={styles.container}>
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
};

export const PrivateNotification = () => {
  console.log('PrivateNotification Rendering');
  const navigate = useNavigate();

  const tabs = [
    {
      id: 'notice',
      label: '공지사항',
      content: null,
    },
    {
      id: 'my-notice',
      label: '내 알림',
      content: <MyNotice />,
    },
  ];

  console.log('PrivateNotification Tabs:', tabs);

  return (
    <div className={styles.container}>
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
};

export default {
  PublicNotification,
  PrivateNotification
};