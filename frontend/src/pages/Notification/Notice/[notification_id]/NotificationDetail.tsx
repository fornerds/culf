import React from 'react';
import { useParams, useMatch } from 'react-router-dom';
import { useNoticeDetail, useNotificationDetail } from '@/hooks/notice/useNotice';
import { Post } from "@/components/molecule";
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

export function NotificationDetail() {
  const { notification_id } = useParams();
  const isMyNotice = useMatch('/notification/my-notice/:notification_id');

  const {
    data: noticeData,
    isLoading: isNoticeLoading,
    error: noticeError
  } = useNoticeDetail(Number(notification_id), !isMyNotice);

  const {
    data: myNotificationData,
    isLoading: isMyNotificationLoading,
    error: myNotificationError
  } = useNotificationDetail(Number(notification_id), !!isMyNotice);

  const isLoading = isMyNotice ? isMyNotificationLoading : isNoticeLoading;
  const error = isMyNotice ? myNotificationError : noticeError;
  const data = isMyNotice ? myNotificationData : noticeData;

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

  if (error || !data) {
    return <div>알림을 불러오는데 실패했습니다.</div>;
  }

  const postData = {
    title: isMyNotice ? data.message : data.title,
    author: {
      name: "컬프",
    },
    date: new Date(data.created_at).toLocaleString('ko-KR'),
    content: isMyNotice ? data.message : data.content
  };

  return <Post {...postData} />;
}