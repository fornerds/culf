// SlideUpModal.tsx
import React, { useEffect, useState } from 'react';
import styles from './SlideUpModal.module.css';
import { Button } from '@/components/atom';

interface SlideUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  navigationLink: string;
  title: string;
  content: string;
}

export function SlideUpModal({
  isOpen,
  onClose,
  navigationLink,
  title,
  content
}: SlideUpModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // 애니메이션 지속 시간과 동일하게 설정
  };

  const handleNavigate = () => {
    window.location.href = navigationLink;
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${isAnimating ? styles.slideUp : styles.slideDown}`}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
        <h2 className={`${styles.title} font-button-1`}>{title}</h2>
        <p className={`${styles.description} font-guidetext`}>{content}</p>
        <Button onClick={handleNavigate}>
          더 대화할래요!
        </Button>
      </div>
    </div>
  );
};