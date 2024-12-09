import React, { useEffect, useRef } from 'react';
import { Card } from '../../molecule/Card';
import styles from './Cards.module.css';

interface CardsProps {
  cards: {
    frontColor: string;
    backColor: string;
    outlineColor: string;
    title: string;
    curator: string;
    hashtags: string[];
    characterImage: string;
    link: string;
  }[];
}

export function Cards({ cards }: CardsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isClick = true;

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      startXRef.current = e.pageX - container.offsetLeft;
      scrollLeftRef.current = container.scrollLeft;
      isClick = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const x = e.pageX - container.offsetLeft;
      const dx = x - startXRef.current;
      if (Math.abs(dx) > 5) {
        isClick = false;
      }
      container.scrollLeft = scrollLeftRef.current - dx;
    };

    const onPointerUp = (e: PointerEvent) => {
      isDraggingRef.current = false;
      if (isClick) {
        handleCardClick(e);
      }
    };

    const handleCardClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement;
      // console.log('Clicked element:', target); // 디버깅 로그
      // console.log('Clicked element classes:', target.className); // 디버깅 로그
      const cardWrapper = target.closest(`.${styles.cardWrapper}`);
      if (cardWrapper) {
        const link = cardWrapper.getAttribute('data-link');
        // console.log('Clicked card link:', link);
        if (link) {
          window.location.href = link; // 임시로 window.location.href 사용
        }
      } else {
        // console.log('No card wrapper found');
        // console.log('Container children:', container.children); // 디버깅 로그
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  return (
    <div className={styles.cardsOuterContainer}>
      <div className={styles.cardsContainer} ref={scrollContainerRef}>
        {cards.map((card, index) => (
          <div
            key={index}
            className={`${styles.cardWrapper} cardWrapper`}
            data-link={card.link}
          >
            <Card {...card} />
          </div>
        ))}
      </div>
    </div>
  );
}
