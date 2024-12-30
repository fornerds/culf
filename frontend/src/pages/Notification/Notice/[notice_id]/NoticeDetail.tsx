import { Post } from "@/components/molecule";
import styles from "./NoticeDetail.module.css"

interface PostProps {
    title: string;
    author: {
      profileImage?: string;
      name: string;
    };
    date: string;
    content: string;
  }

export function NoticeDetail () {
    const postData = {
        title: "[공지사항] 컬프에서 새로운 큐레이터의 출시를 알립니다!",
        author: {
          name: "버킷트레블",
        },
        date: "08:19 PM",
        content: `안녕하세요 여러분! 버킷트레블입니다 :)

오늘은 공지사항에 관련해서 말씀드릴건데요!

공지사항은 공지사항일 뿐, 크게 의미는 없지만 아무 말이라도 적기 위해서 공지사항을 작성했답니다. 글이 좀 길어야 되거든요 조금 더 쓸게요!

그렇게 공지사항을 확인하시면, 다시 돌아가시면 됩니다. 앞으로도 더 열심히 하는 컬프가 되겠습니다.

감사합니다!`};

    return <Post {...postData} />;
}