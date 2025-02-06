import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/notice/useNotice';
import { NoticeList } from '@/components/molecule';
import styles from './MyNotice.module.css';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

export const MyNotice = () => {
  console.log('MyNotice Component Rendering');
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotifications();
  
  console.log('MyNotice Data:', {
    isLoading,
    error,
    data,
  });

  if (error) {
    return <div className={styles.errorMessage}>알림을 불러오는데 실패했습니다.</div>;
  }

  if (!data?.notifications.length) {
    return (
      <div className={styles.emptyMessage}>
        <p className="font-button-2">알림이 없습니다.</p>
      </div>
    );
  }

  const formattedNotices = data.notifications.map(notification => ({
    id: notification.notification_id.toString(),
    title: notification.message,
    date: new Date(notification.created_at).toLocaleDateString()
  }));

  return (
    <div className={styles.notificationWrapper}>
      <NoticeList 
        notices={formattedNotices}
        onNoticeClick={(id) => navigate(`/notification/my-notice/${id}`)}
      />
    </div>
  );
};