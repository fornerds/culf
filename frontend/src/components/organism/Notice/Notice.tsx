import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingAnimation } from '@/components/atom';
import { useNotices } from '@/hooks/notice/useNotice';
import logoimage from '@/assets/images/culf.png';
import styles from './Notice.module.css';

export const Notice = () => {
  console.log('Notice Component Rendering');
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotices();

  console.log('Notice Data:', {
    isLoading,
    error,
    data
  });

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200} 
        />
        <p className="font-tag-1" style={{color: "#a1a1a1"}}>로딩 중</p>
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorMessage}>공지사항을 불러오는데 실패했습니다.</div>;
  }

  const formattedNotices = data?.notices || [];

  return (
    <div className={styles.container}>
      <div className={styles.noticeList}>
        {formattedNotices.map((notice) => (
          <div
            key={notice.notice_id}
            className={`${styles.noticeItem} ${notice.is_important ? styles.important : ''}`}
            onClick={() => navigate(`/notification/notice/${notice.notice_id}`)}
          >
            <div className={styles.basicListContainer}>
              <h3 className={`${styles.title} font-text-2`}>{notice.title}</h3>
              <p className={`${styles.content} font-text-4`}>{notice.content}</p>
              <span className={`${styles.date} font-tag-2`}>
                {new Date(notice.created_at).toLocaleDateString()}
              </span>
              {notice.is_read && (
                <span className={`${styles.readStatus} font-tag-2`}>읽음</span>
              )}
            </div>
          </div>
        ))}
        
        {!formattedNotices.length && (
          <div className={styles.empty}>
            <p className="font-button-2">등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};