import React from 'react';
import styles from './Layout.module.css';
import { Header } from '../Header';
import { SideMenu } from '../../molecule';
import { useHeaderStore } from '../../../state/client/useHeaderStore';
import { useSideMenuStore } from '../../../state/client/useSideMenuStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { useHeader, remainingTokens } = useHeaderStore();
  const { isOpen, toggle } = useSideMenuStore();

  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        {useHeader && <Header />}
        {children}
        <SideMenu
          isOpen={isOpen}
          onClose={toggle}
          remainingTokens={remainingTokens}
        />
      </div>
    </div>
  );
}
