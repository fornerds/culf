import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './SideMenu.module.css';
import CloseIcon from '@/assets/icons/close.svg?react';
import UserIcon from '@/assets/icons/user.svg?react';
import NotificationIcon from '@/assets/icons/notification.svg?react';
import InquiryIcon from '@/assets/icons/inquiry.svg?react';
import LinkIcon from '@/assets/icons/link.svg?react';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  remainingTokens: number;
}

export function SideMenu({ isOpen, onClose, remainingTokens }: SideMenuProps) {
  useEffect(() => {
    console.log('SideMenu isOpen changed to:', isOpen);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={`${styles.sideMenu} ${isOpen ? styles.open : ''}`}>
        <header>
          <div className={styles.sideMenuHeader}>
            <div className={styles.sideMenuHeaderTitle}>
              <h3 className="font-title-3">컬프랜드</h3>
              <p className="font-text-1">님</p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <CloseIcon width="18px" height="20px" />
            </button>
          </div>
          <section className={styles.tokenInfo}>
            <div className={styles.tokenRemainInfo}>
              <h4 className="font-title-3">남은 토큰 개수</h4>{' '}
              <div className={styles.tokenRemainCount}>
                <div className="font-title-2">{remainingTokens}</div>
                <div className={styles.tokenRemainCountText}>개</div>
              </div>
            </div>
            <p className={styles.tokenDesc}>
              큐레이터와 대화를 더 나누려면 '토큰'이 필요해요.
            </p>
            <Link
              to="/pricing"
              className={`${styles.buyTokensButton} font-button-2`}
              onClick={onClose}
            >
              토큰 추가 결제
            </Link>
          </section>
        </header>
        <nav className={styles.menuItems}>
          <Link to="/mypage" onClick={onClose} className="font-text-2">
            <span>
              <UserIcon /> 마이페이지
            </span>
            <LinkIcon />
          </Link>
          <Link to="/notification" onClick={onClose} className="font-text-2">
            <span>
              <NotificationIcon /> 알림
            </span>
            <LinkIcon />
          </Link>
          <Link to="/inquiry" onClick={onClose} className="font-text-2">
            <span>
              <InquiryIcon /> 문의하기
            </span>
            <LinkIcon />
          </Link>
        </nav>
      </div>
    </>
  );
}
