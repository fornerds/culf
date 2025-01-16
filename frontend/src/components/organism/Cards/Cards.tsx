import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../molecule/Card';
import styles from './Cards.module.css';
import { chat } from '@/api';
import { useChatRoomStore } from '@/state/client/chatRoomStore';
import { tokenService } from '@/utils/tokenService';

interface CardsProps {
  cards: {
    frontColor: string;
    backColor: string;
    outlineColor: string;
    title: string;
    curator: string;
    hashtags: string[];
    characterImage: string;
    curatorId: number;
  }[];
}

export function Cards({ cards }: CardsProps) {
  const navigate = useNavigate();
  const setCurrentRoom = useChatRoomStore((state) => state.setCurrentRoom);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const clickStartTimeRef = useRef(0);

  const handleCardClick = async (curatorId: number) => {
    const isAuthenticated = !!tokenService.getAccessToken();
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const response = await chat.createChatRoom(curatorId);
      const { room_id, curator } = response.data;
      
      setCurrentRoom({
        roomId: room_id,
        curatorId: curatorId,
        curatorInfo: {
          name: curator.name,
          profileImage: curator.profile_image,
          persona: curator.persona
        }
      });
      
      navigate(`/chat/${room_id}`);
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      startXRef.current = e.pageX - container.offsetLeft;
      scrollLeftRef.current = container.scrollLeft;
      clickStartTimeRef.current = Date.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      
      const x = e.pageX - container.offsetLeft;
      const dx = x - startXRef.current;
      container.scrollLeft = scrollLeftRef.current - dx;
    };

    const onPointerUp = (e: PointerEvent) => {
      const clickDuration = Date.now() - clickStartTimeRef.current;
      const isQuickClick = clickDuration < 200; // 200ms 이내의 클릭만 처리

      if (isQuickClick) {
        const target = e.target as HTMLElement;
        const cardWrapper = target.closest(`.${styles.cardWrapper}`);
        
        if (cardWrapper) {
          const curatorId = cardWrapper.getAttribute('data-curator-id');
          if (curatorId) {
            handleCardClick(parseInt(curatorId));
          }
        }
      }

      isDraggingRef.current = false;
    };

    const onPointerLeave = () => {
      isDraggingRef.current = false;
    };

    // 모바일에서 스크롤 중에 화면이 끌려가는 것을 방지
    const preventDrag = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('touchmove', preventDrag, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      container.removeEventListener('touchmove', preventDrag);
    };
  }, [navigate, setCurrentRoom]);

  return (
    <div className={styles.cardsOuterContainer}>
      <div className={styles.cardsContainer} ref={scrollContainerRef}>
        {cards.map((card, index) => (
          <div
            key={index}
            className={`${styles.cardWrapper} cardWrapper`}
            data-curator-id={card.curatorId}
          >
            <Card {...card} />
          </div>
        ))}
      </div>
    </div>
  );
}