import React from 'react';
import { useNotifications } from '@/hooks/notice/useNotice';
import { NoticeList } from '@/components/molecule';
import styles from './MyNotice.module.css';

export function MyNotice() {
  const { data, isLoading, error } = useNotifications({});

  if (isLoading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>Failed to load notifications</div>;

  const formattedNotices = data?.notifications.map(notification => ({
    id: notification.notification_id.toString(),
    title: notification.message,
    date: new Date(notification.created_at).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
  })) || [];

  if (!data?.notifications.length) {
    return (
      <div className={styles.empty}>
        <p className="font-button-2">알림이 없습니다.</p>
      </div>
    );
  }

  return <NoticeList notices={formattedNotices} />;
}