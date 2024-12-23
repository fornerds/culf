import React from 'react';
import styles from './Layout.module.css';
import { Header } from '../Header';
import { Modal, SideMenu } from '../../molecule';
import { useHeaderStore } from '../../../state/client/useHeaderStore';
import { useSideMenuStore } from '../../../state/client/useSideMenuStore';
import useModalStore from '@/state/client/useModalStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { useHeader, remainingTokens } = useHeaderStore();
  const { isOpen, toggle } = useSideMenuStore();
  const {
    isModalOpen,
    description,
    pointDescription,
    confirmButtonText,
    onConfirm,
    closeModal,
  } = useModalStore();

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
        <Modal
          isModalOpen={isModalOpen}
          description={description}
          pointDescription={pointDescription}
          confirmButtonText={confirmButtonText}
          onConfirm={onConfirm}
          closeModal={closeModal}
        />
      </div>
    </div>
  );
}
