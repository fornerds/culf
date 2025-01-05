import React from 'react';
import { useNotifications } from '@/hooks/notice/useNotice';
import { NoticeList } from '@/components/molecule';
import styles from './MyNotice.module.css';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

export function MyNotice() {
  const { data, isLoading, error } = useNotifications({});

  if (isLoading) {
    return (
      <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200} 
        />
        <p className='font-tag-1' style={{color: "#a1a1a1"}}>로딩 중</p>
      </div>
    );
  }
  
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