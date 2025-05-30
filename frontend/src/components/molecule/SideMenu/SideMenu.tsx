import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './SideMenu.module.css';
import CloseIcon from '@/assets/icons/close.svg?react';
import UserIcon from '@/assets/icons/user.svg?react';
import NotificationIcon from '@/assets/icons/notification.svg?react';
import InquiryIcon from '@/assets/icons/inquiry.svg?react';
import LinkIcon from '@/assets/icons/link.svg?react';
import { useUser } from '@/hooks/user/useUser';
import { useAuthStore } from '@/state/client/authStore';
import { useTokenStore } from '@/state/client/useStoneStore';
import { tokenService } from '@/utils/tokenService';
import { Button } from '@/components/atom';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { getUserInfo } = useUser();
  const { tokens, setShouldRefresh } = useTokenStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const accessToken = tokenService.getAccessToken();
  const userInfo = getUserInfo.data;

  // SideMenu가 열릴 때마다 사용자 데이터 새로고침
  useEffect(() => {
    if (isOpen && accessToken) {
      setShouldRefresh(true);
    }
  }, [isOpen, accessToken, setShouldRefresh]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={`${styles.sideMenu} ${isOpen ? styles.open : ''}`}>
        <header>
          <div className={styles.sideMenuHeader}>
            {accessToken ? (
              <div className={styles.sideMenuHeaderTitle}>
                <h3 className="font-title-3">
                  {userInfo?.nickname || '사용자'}
                </h3>
                <p className="font-text-1">님</p>
              </div>
            ) : (
              <div className={styles.loginButtonWrap}>
                <h3 className="font-title-3">
                  서비스를 이용하려면 로그인이 필요합니다.
                </h3>
                <Button
                  size="size1"
                  variant="default"
                  onClick={() => {
                    onClose();
                    navigate('/login');
                  }}
                >
                  로그인하러 가기
                </Button>
              </div>
            )}
            <button className={styles.closeButton} onClick={onClose}>
              <CloseIcon width="18px" height="20px" />
            </button>
          </div>
          {accessToken && (
            <section className={styles.tokenInfo}>
              <div className={styles.tokenRemainInfo}>
                <h4 className="font-title-3">남은 스톤</h4>
                <div className={styles.tokenRemainCount}>
                  <div className="font-title-2">{tokens}</div>
                  <div className={styles.tokenRemainCountText}>개</div>
                </div>
              </div>
              <p className={styles.tokenDesc}>
                AI 캐릭터와 대화를 더 나누려면 '스톤'이 필요해요.
              </p>
              <Link
                to="/pricing"
                className={`${styles.buyTokensButton} font-button-2`}
                onClick={onClose}
              >
                스톤 구매하기
              </Link>
            </section>
          )}
        </header>
        <nav className={styles.menuItems}>
          {accessToken && (
            <Link
              to="/mypage/account"
              onClick={onClose}
              className="font-text-2"
            >
              <span>
                <UserIcon /> 마이페이지
              </span>
              <LinkIcon />
            </Link>
          )}
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
