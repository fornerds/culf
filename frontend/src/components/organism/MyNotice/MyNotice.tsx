import { NoticeList } from "@/components/molecule";
import styles from "./Notice.module.css" 

export function MyNotice () {
    const notices = [
        {
          id: '3',
          title: '토큰 50개 결제가 완료되었습니다.',
          date: '2024. 8. 23'
        },
        {
          id: '2',
          title: '구독 신청되었습니다.',
          date: '2024. 8. 22'
        },
        {
            id: '1',
            title: '첫 해외여행 큐레이터와의 대화를 축하드려요!',
            date: '2024. 8. 21'
        }
      ];

      
    return <NoticeList notices={notices} />
}