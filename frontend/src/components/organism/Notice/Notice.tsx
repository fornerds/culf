import React from 'react';
import { useNotification } from '@/hooks/notice/useNotice';
import styles from './Notice.module.css';

interface NotificationListProps {
  page?: number;
  limit?: number;
}

export function Notice({ page = 1, limit = 10 }: NotificationListProps) {
  const { getNotifications } = useNotification();
  const { data, isLoading, error } = getNotifications({ page, limit });

  console.log(data?.notifications);
  

  if (isLoading) {
    return <div className={styles.container}>Loading notifications...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>알림을 불러오는데 실패했습니다.</div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.notificationList}>
        {data?.notifications.map((notification) => (
          <div
            key={notification.notification_id}
            className={`${styles.notificationItem} ${notification.is_read ? styles.read : ''}`}
          >
            <div className={styles.notificationContent}>
              <div>
                <p className={styles.message}>{notification.message}</p>
                <p className={styles.date}>
                  {new Date(notification.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {!notification.is_read && (
                <span className={styles.badge}>새로운 알림</span>
              )}
            </div>
          </div>
        ))}
        
        {(!data?.notifications.length || data.total_count === 0) && (
          <div className={`${styles.empty} font-button-2`}>알림이 없습니다.</div>
        )}
      </div>
    </div>
  );
}