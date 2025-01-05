import React from 'react';
import styles from './NoticeList.module.css';
import { useNavigate } from 'react-router-dom';

interface Notice {
    id: string;
    title: string;
    content?: string;
    date: string;
  }

interface NoticeListProps {
  notices: Notice[];
  onNoticeClick?: (noticeId: string) => void;
}

export function NoticeList ({notices, onNoticeClick}: NoticeListProps) {
    const navigate = useNavigate()

  const handleNoticeClick = (noticeId: string) => {
    if (onNoticeClick) {
      onNoticeClick(noticeId);
    } else {
        navigate(`/notification/notice/${noticeId}`);
    }
  };

    return (<div className={styles.noticeList}>
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={styles.noticeItem}
            onClick={() => handleNoticeClick(notice.id)}
          >
            <h3 className={`${styles.title} font-text-2`}>{notice.title}</h3>
            {notice.content && (
              <p className={`${styles.content} font-text-4`}>{notice.content}</p>
            )}
            <span className={`${styles.date} font-tag-2`}>{notice.date}</span>
          </div>
        ))}
      </div>)
}