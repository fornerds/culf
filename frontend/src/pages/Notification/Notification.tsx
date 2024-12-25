import { useNavigate, useParams } from 'react-router-dom';
import styles from './Notification.module.css';
import { MyNotice, Notice } from '@/components/organism';
import { Tab } from '@/modules';

export function Notification() {
  const { tab } = useParams();
  const navigate = useNavigate();

  const tabs = [
    {
      id: 'notice',
      label: '공지사항',
      content: <Notice />,
    },
    {
      id: 'my-notice',
      label: '내 알림',
      content: <MyNotice />,
    },
  ];

  return (<>
      <main className={styles.notification}>
      </main>
      <Tab
        tabs={tabs}
        defaultActiveTab={tab}
        onClickTab={(tabId) => navigate(`/notification/${tabId}`, { replace: true })}
      />
  </>);
}
