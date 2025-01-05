import { Post } from "@/components/molecule";
import { useParams } from 'react-router-dom';
import { useNoticeDetail } from '@/hooks/notice/useNotice';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';

export function NoticeDetail() {
  const { notice_id } = useParams();
  const { data: notice, isLoading, error } = useNoticeDetail(Number(notice_id));

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

  if (error || !notice) {
    return <div>공지사항을 불러오는데 실패했습니다.</div>;
  }

  const postData = {
    title: notice.title,
    author: {
      name: "컬프",
    },
    date: new Date(notice.created_at).toLocaleString('ko-KR'),
    content: notice.content
  };

  return <Post {...postData} />;
}