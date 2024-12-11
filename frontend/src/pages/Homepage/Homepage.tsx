import { useState, useEffect } from 'react';
import styles from './Homepage.module.css';
import { Header, Cards, ChatList } from '../../components/organism';
import { Footer } from '../../components/molecule';
import { HeroBanner, SlideItem } from '../../modules';
import { useAuthStore } from '../../state/client/authStore';
import { useGetConversations } from '../../state/server/chatQueries';

interface ChatListData {
  id: string;
  curatorImage: {
    curatorimage: string;
  };
  curatorName: string;
  lastMessage: string;
  lastMessageDate: string;
}

function getImageUrl(name: string): string {
  return new URL(`../../assets/images/${name}`, import.meta.url).href;
}

const CURATOR_IMAGES: { [key: string]: string } = {
  '1': 'curator01.png',
  '2': 'curator02.png',
  '3': 'curator03.png',
};

const CURATOR_NAMES: { [key: string]: string } = {
  '1': '네오',
  '2': '레미',
  '3': '두리',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function Homepage() {
  const { isAuthenticated, user } = useAuthStore();
  const { 
    data: conversationsData, 
    isLoading,
    error,
    refetch 
  } = useGetConversations({ 
    limit: 5,
    sort: 'question_time:desc',
    summary: true 
  });

  console.log(conversationsData)

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

  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const transformConversations = (): ChatListData[] => {
    if (!isAuthenticated || !conversationsData?.pages[0]?.conversations) return [];

    return conversationsData.pages[0].conversations.map((conv: any) => {
      const curatorId = conv.curator_id || '1';
      
      return {
        id: conv.conversation_id,
        curatorImage: {
          curatorimage: getImageUrl(CURATOR_IMAGES[curatorId])
        },
        curatorName: CURATOR_NAMES[curatorId],
        lastMessage: conv.question_summary || conv.question || '대화 내용이 없습니다.',
        lastMessageDate: formatDate(conv.question_time),
        chatLink: `/beta/chat/${curatorId}/${conv.conversation_id}`
      };
    });
  };

  const NoChats = () => (
    <div className={styles.noneChatList}>
      {!isAuthenticated ? '로그인 후 이용해주세요.' :
       isLoading ? '대화 목록을 불러오는 중입니다...' :
       error ? '대화 목록을 불러오는데 실패했습니다.' :
       '지난 대화 목록이 없습니다.'}
    </div>
  );

  const chatList = transformConversations();

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
          {chatList.length > 0 ? <ChatList chats={chatList} /> : <NoChats />}
        </section>
      </main>
      <Footer />
    </>
  );
}