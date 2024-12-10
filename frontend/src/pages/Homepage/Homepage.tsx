import { useState } from 'react';
import styles from './Homepage.module.css';
import curatorimage from '../../assets/images/curator01.png';
import { Header, Cards, ChatList } from '../../components/organism';
import { Footer } from '../../components/molecule';
import { HeroBanner, SlideItem } from '../../modules';

function getImageUrl(name: string): string {
  return new URL(`../../assets/images/${name}`, import.meta.url).href;
}

export function Homepage() {
  const chats: string | any[] = [];

  const slides: SlideItem[] = [
    { imageUrl: getImageUrl('herobanner01.png'), link: 'http://pf.kakao.com/_KxoAdn' },
    { imageUrl: getImageUrl('herobanner02.png'), link: '/' },
    { imageUrl: getImageUrl('herobanner03.png'), link: '/' },
    { imageUrl: getImageUrl('herobanner04.png'), link: '/' },
  ];

  const cardsData = [
    {
      frontColor: '#FFF945',
      backColor: '#CCB700',
      outlineColor: '#7D6200', 
      title: '지구 예술에 푹 빠진 외계인',
      curator: '네오',
      hashtags: ['초보', '미술입문'],
      characterImage: getImageUrl('character01.png'),
      link: '/beta/chat/1',
    },
    {
      frontColor: '#69ADFF',
      backColor: '#3E93FB',
      outlineColor: '#0038A8', 
      title: '19세기 출신 파리지앵',
      curator: '레미',
      hashtags: ['유럽', '인상주의'],
      characterImage: getImageUrl('character02.png'),
      link: '/beta/chat/2',
    },
    {
      frontColor: '#00FFC8',
      backColor: '#00B18C',
      outlineColor: '#007544', 
      title: '감성 충만한 미술 애호가',
      curator: '두리',
      hashtags: ['국내', '동시대미술'],
      characterImage: getImageUrl('character03.png'),
      link: '/beta/chat/3',
    },
  ];

  const NoChats = () => (
    <div className={styles.noneChatList}>
      지난 대화 목록이 없습니다.
    </div>
  );

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
          {chats.length > 0 ? <ChatList chats={chats} /> : <NoChats />}
        </section>
      </main>
      <Footer />
    </>
  );
}