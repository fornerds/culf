import React from 'react';
import { useNotices } from '@/hooks/notice/useNotice';
import { useNavigate } from 'react-router-dom';
import styles from './Notice.module.css';

interface NoticeListProps {
  page?: number;
  limit?: number;
}

export function Notice({ page = 1, limit = 10 }: NoticeListProps) {
  const { data, isLoading, error } = useNotices({ page, limit });

  if (isLoading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.container}>Failed to load notices</div>;
  }

  const sortedNotices = data?.notices.sort((a, b) => {
    if (a.is_important !== b.is_important) {
      return b.is_important ? 1 : -1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.noticeList}>
        {sortedNotices?.map((notice) => (
          <div
            key={notice.notice_id}
            className={`${styles.noticeItem} ${notice.is_important ? styles.important : ''}`}
            onClick={() => navigate(`/notification/notice/${notice.notice_id}`)}
          >
            <div className={styles.noticeHeader}>
              <div className={styles.titleContainer}>
                {notice.is_important && (
                  <span className={styles.importantBadge}>중요</span>
                )}
                <h3 className={styles.title}>{notice.title}</h3>
                {!notice.is_read && (
                  <span className={styles.newBadge}>NEW</span>
                )}
              </div>
              <span className={styles.date}>
                {new Date(notice.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className={styles.content}>{notice.content}</p>
          </div>
        ))}
        
        {(!data?.notices.length) && (
          <div className={styles.empty}>
            <p className="font-button-2">등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}