import { NoticeList } from "@/components/molecule";
import styles from "./Notice.module.css" 

export function Notice () {
    const notices = [
        {
          id: '2',
          title: '[공지사항] 2024년 9월 2일에 업데이트가 진행될 예정입니다. 서비스 이용에 불편한 일이 발생하지 않도록 주의해주시기 바랍니다.',
          content: '여러분 안녕하세요! 컬프의 다양한 큐레이터를 소개합니다.',
          date: '2024. 8. 23'
        },
        {
          id: '1',
          title: '[공지사항] 컬프에서 새로운 큐레이터의 출시를 알립니다.',
          content: '안녕하세요 여러분! 버킷트레블입니다 :) 오늘은 공지사항에 새로운 큐레이터를 소개하려고 합니다. 이번에 새로 출시되는 큐레이터는 레미입니다.',
          date: '2024. 8. 22'
        }
      ];

      
    return <NoticeList notices={notices} />
}