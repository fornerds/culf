import styles from './Homepage.module.css';
import curatorimage from '../../assets/images/curator01.png';
import { Header, Cards, ChatList } from '../../components/organism';
import { Footer } from '../../components/molecule';
import { HeroBanner, SlideItem } from '../../modules';

// 이미지 URL을 생성하는 헬퍼 함수
function getImageUrl(name: string): string {
  return new URL(`../../assets/images/${name}`, import.meta.url).href;
}

export function Homepage() {
  // 슬라이드 데이터
  const slides: SlideItem[] = [
    { imageUrl: getImageUrl('herobanner01.png'), link: '/mypage' },
    { imageUrl: getImageUrl('herobanner02.png'), link: '/mypage' },
    { imageUrl: getImageUrl('herobanner03.png'), link: '/mypage' },
    { imageUrl: getImageUrl('herobanner04.png'), link: '/mypage' },
  ];

  const cardsData = [
    {
      frontColor: '#FFF945',
      backColor: '#CCB700',
      outlineColor: '#7D6200', 
      title: '지구 예술에 푹 빠진 외계인',
      curator: '네오',
      hashtags: ['유럽', '여행지추천'],
      characterImage: getImageUrl('character01.png'),
      link: '/beta/chat/1',
    },
    {
      frontColor: '#69ADFF',
      backColor: '#3E93FB',
      outlineColor: '#0038A8', 
      title: '19세기 출신 파리지앵',
      curator: '레미',
      hashtags: ['유럽', '여행지추천'],
      characterImage: getImageUrl('character02.png'),
      link: '/beta/chat/2',
    },
    {
      frontColor: '#00FFC8',
      backColor: '#00B18C',
      outlineColor: '#007544', 
      title: '감성 충만한 미술 애호가',
      curator: '두리',
      hashtags: ['유럽', '여행지추천'],
      characterImage: getImageUrl('character03.png'),
      link: '/beta/chat/3',
    },
  ];

  const chatsData = [
    {
      id: '1',
      curatorImage: { curatorimage },
      curatorName: '국내여행 큐레이터 코리',
      lastMessage:
        '서울에서 꼭 가봐야할 맛집은 취향에 따라 달라질 수 있겠지만 저는 이 맛집을 추천합니다!',
      lastMessageDate: '오전 12:47',
    },
    {
      id: '2',
      curatorImage: { curatorimage },
      curatorName: '문화 큐레이터 컬리',
      lastMessage: '이렇게 여행계획을 세우는 것은 어떨까요?',
      lastMessageDate: '어제',
    },
    {
      id: '3',
      curatorImage: { curatorimage },
      curatorName: '해외여행 큐레이터 몰리',
      lastMessage:
        '문의하신 콘서트는 이미 티켓이 마감되었어요 취향에 따라 달라질 수 있겠지만 저는 이 맛집을 추천합니다!',
      lastMessageDate: '8월 2일',
    },
    {
      id: '4',
      curatorImage: { curatorimage },
      curatorName: '미술관 큐레이터 아티',
      lastMessage: '모나 미술관에서 진행중인 상설 전시는 두 가지가 있습니다',
      lastMessageDate: '8월 2일',
    },
    {
      id: '5',
      curatorImage: { curatorimage },
      curatorName: '국내여행 큐레이터 코리',
      lastMessage:
        '서울에서 꼭 가봐야할 맛집은 취향에 따라 달라질 수 있겠지만 저는 이 맛집을 추천합니다!',
      lastMessageDate: '8월 1일',
    },
  ];

  return (
    <>
      <main className={styles.main}>
        <HeroBanner slides={slides} />
        <section className={styles.curatorListSection}>
          <h2 className={`${styles.sectionTitle} font-title-2`}>
            어떤 컬처 프렌드와 이야기 해볼까요?
          </h2>
          <Cards cards={cardsData} />
        </section>
        <section className={styles.chatListSection}>
          <h2 className={`${styles.sectionTitle} font-title-2`}>
            지난 대화를
            <br />
            이어가 볼까요?
          </h2>
          <ChatList chats={chatsData} />
        </section>
      </main>
      <Footer />
    </>
  );
}
