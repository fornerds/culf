import React from 'react';
import styles from './Header.module.css';
import LeftIcon from '@/assets/icons/left.svg?react';
import MenuIcon from '@/assets/icons/menu.svg?react';
import { useNavigate } from 'react-router-dom';
import { useHeaderStore } from '../../../state/client/useHeaderStore';
import { useSideMenuStore } from '../../../state/client/useSideMenuStore';

export function Header() {
  const navigate = useNavigate();
  const { title, showBackButton, showMenuButton } = useHeaderStore();
  const { toggle } = useSideMenuStore();

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleMenuClick = () => {
    console.log('Menu button clicked in Header');
    toggle();
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        {showBackButton ? (
          <button className={styles.button} onClick={handleBackClick}>
            <LeftIcon />
          </button>
        ) : (
          <div className={styles.empty}></div>
        )}
      </div>
      <div className={styles.titleSection}>
        {typeof title === 'string' ? (
          <h1 className={`${styles.title} font-card-title-1`}>{title}</h1>
        ) : (
          title
        )}
      </div>
      <div className={styles.rightSection}>
        {showMenuButton ? (
          <button className={styles.button} onClick={handleMenuClick}>
            <MenuIcon />
          </button>
        ) : (
          <div className={styles.empty}></div>
        )}
      </div>
    </header>
  );
}
