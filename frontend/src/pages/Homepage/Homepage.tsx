import React from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './Homepage.module.css';
import { Header, Cards, ChatList } from '@/components/organism';
import { Footer } from '@/components/molecule';
import { HeroBanner } from '@/modules';
import { chat, curator } from '@/api';
import { LoadingAnimation } from '@/components/atom';
import logoimage from '@/assets/images/culf.png';
import { tokenService } from '@/utils/tokenService';

interface SlideItem {
  imageUrl: string;
  link: string;
}

const getImageUrl = (name: string): string => {
  return new URL(`../../assets/images/${name}`, import.meta.url).href;
};

export function Homepage() {
  const isAuthenticated = !!tokenService.getAccessToken();

  const { data: curators, isLoading: isCuratorsLoading } = useQuery({
    queryKey: ['curators'],
    queryFn: async () => {
      try {
        const response = await curator.getCurators();
        return response.data;
      } catch (error) {
        console.log('Curator fetch error:', error);
        return []; // 에러 발생시 빈 배열 반환
      }
    },
    retry: false, // API 호출 실패시 재시도 하지 않음
  });

  // Fetch chat rooms - only if authenticated
  const { data: chatRooms, isLoading: isChatRoomsLoading } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      try {
        const response = await chat.getChatRooms();
        return response.data;
      } catch (error) {
        console.log('ChatRoom fetch error:', error);
        return []; // 에러 발생시 빈 배열 반환
      }
    },
    enabled: isAuthenticated, // 인증된 경우에만 실행
    retry: false, // API 호출 실패시 재시도 하지 않음
  });

  const slides: SlideItem[] = [
    { imageUrl: getImageUrl('herobanner01.png'), link: 'http://pf.kakao.com/_KxoAdn' },
    { imageUrl: getImageUrl('herobanner02.png'), link: '/' },
    { imageUrl: getImageUrl('herobanner03.png'), link: '/' },
    { imageUrl: getImageUrl('herobanner04.png'), link: '/' },
  ];

  // Format curator data for Cards component
  const cardsData = curators?.map(curator => ({
    frontColor: curator.theme?.frontColor || '#FFF945',
    backColor: curator.theme?.backColor || '#CCB700',
    outlineColor: curator.theme?.outlineColor || '#7D6200',
    title: curator.persona,
    curator: curator.name,
    hashtags: curator.tags?.map(tag => tag.name) || [],
    characterImage: curator.main_image,
    curatorId: curator.curator_id
  })) || [];

  console.log("chatRooms", chatRooms);
  

  // Format chat rooms data for ChatList component
  const formattedChatRooms = (chatRooms?.map(room => ({
    id: room.room_id,
    curatorImage: {
      curatorimage: room.curator.profile_image
    },
    curatorName: room.curator.name,
    lastMessage: room.title || '',
    lastMessageDate: new Date(room.created_at || '').toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  })) || []).slice(0, 5);

  const NoChats = () => (
    <div className={styles.noneChatList}>
      지난 대화 목록이 없습니다.
    </div>
  );

  if (isCuratorsLoading || isChatRoomsLoading) {
    return (
      <div style={{marginTop: "250px", display: "flex", alignItems: "center", flexDirection: "column", gap: "10px" }}>
        <LoadingAnimation
          imageUrl={logoimage}
          alt="Description"
          width={58}
          height={19}
          duration={2200} 
        />
      <p className='font-tag-1' style={{color: "#a1a1a1"}}>로그인 확인 중</p>
    </div>
    );
  }

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
            지난 대화를<br />이어가 볼까요?
          </h2>
          {formattedChatRooms.length > 0 ? (
            <ChatList chats={formattedChatRooms} />
          ) : (
            <NoChats />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

export default Homepage;