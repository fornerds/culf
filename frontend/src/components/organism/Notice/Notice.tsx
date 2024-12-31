import React from 'react';
import { useNotices } from '@/hooks/notice/useNotice';
import { useNavigate } from 'react-router-dom';
import styles from './Notice.module.css';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';
import PinIcon from '@/assets/icons/pin.svg?react';

interface NoticeListProps {
  page?: number;
  limit?: number;
}

export function Notice({ page = 1, limit = 10 }: NoticeListProps) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotices({ page, limit });

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

  if (error) {
    return <div className={styles.container}>공지사항을 불러오는데 실패했습니다.</div>;
  }

  const sortedNotices = data?.notices?.sort((a, b) => {
    if (a.is_important !== b.is_important) {
      return b.is_important ? 1 : -1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) || [];

  return (
    <div className={styles.container}>
      <div className={styles.noticeList}>
        {sortedNotices.map((notice) => (
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
            </div>
            {notice.is_important && <PinIcon width="24px" height="24px"/>}
          </div>
        ))}
        
        {(!sortedNotices.length) && (
          <div className={styles.empty}>
            <p className="font-button-2">등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}