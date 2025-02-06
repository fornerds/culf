import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingAnimation } from '@/components/atom';
import { useNotices } from '@/hooks/notice/useNotice';
import logoimage from '@/assets/images/culf.png';
import styles from './Notice.module.css';

const stripHtmlTags = (html: string): string => {
  // 임시 div 엘리먼트 생성
  const temp = document.createElement('div');
  // HTML 문자열을 div에 삽입
  temp.innerHTML = html;
  // 텍스트 컨텐츠를 가져옴
  const text = temp.textContent || temp.innerText || '';
  
  return text
    // 먼저 모든 연속된 공백 문자를 단일 공백으로 변환
    .replace(/\s+/g, ' ')
    // 마침표 뒤에 공백이 없는 경우 공백 추가
    .replace(/\.(?=[^\s])/g, '. ')
    // 불필요한 여러 공백을 하나로
    .replace(/\s+/g, ' ')
    // 시작과 끝의 공백 제거
    .trim();
};

// 글자 수 제한도 좀 더 길게 조정
const truncateText = (text: string, maxLength: number = 150): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const Notice = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useNotices();

  if (error) {
    return <div className={styles.errorMessage}>공지사항을 불러오는데 실패했습니다.</div>;
  }

  const formattedNotices = data?.notices || [];

  return (
    <div className={styles.container}>
      <div className={styles.noticeList}>
        {formattedNotices.map((notice) => {
          // HTML 태그를 제거하고 공백을 정규화한 후 텍스트 길이를 제한
          const plainContent = truncateText(stripHtmlTags(notice.content));

          return (
            <div
              key={notice.notice_id}
              className={`${styles.noticeItem} ${notice.is_important ? styles.important : ''}`}
              onClick={() => navigate(`/notification/notice/${notice.notice_id}`)}
            >
              <div className={styles.basicListContainer}>
                <h3 className={`${styles.title} font-text-2`}>{notice.title}</h3>
                <p className={`${styles.content} font-text-4`}>{plainContent}</p>
                <span className={`${styles.date} font-tag-2`}>
                  {new Date(notice.created_at).toLocaleDateString()}
                </span>
                {notice.is_read && (
                  <span className={`${styles.readStatus} font-tag-2`}>읽음</span>
                )}
              </div>
            </div>
          );
        })}
        
        {!formattedNotices.length && (
          <div className={styles.empty}>
            <p className="font-button-2">등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};