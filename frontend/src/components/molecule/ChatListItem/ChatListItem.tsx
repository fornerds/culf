import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ChatListItem.module.css';
import LinkIcon from '@/assets/icons/link.svg?react';

interface ChatListItemProps {
  curatorImage: string;
  curatorName: string;
  lastMessage: string;
  lastMessageDate: string;
  chatLink: string;
  onDelete?: () => void;
}

export function ChatListItem({
  curatorImage,
  curatorName,
  lastMessage,
  lastMessageDate,
  chatLink,
  onDelete,
}: ChatListItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking delete
    e.stopPropagation(); // Prevent event bubbling
    
    if (!onDelete || isDeleting) return;
    
    if (window.confirm('채팅방을 삭제하시겠습니까?')) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className={styles.chatListItem}>
      <Link to={chatLink} className={styles.chatContent}>
        <div className={styles.curatorImageContainer}>
          <img
            src={curatorImage}
            alt={curatorName}
            className={styles.curatorImage}
          />
        </div>
        <div className={styles.chatInfo}>
          <h3 className={`${styles.curatorName} font-button-2`}>{curatorName}</h3>
          <p className={`${styles.lastMessage} font-text-4`}>{lastMessage}</p>
          <span className={`${styles.lastMessageDate} font-tag-2`}>
            {lastMessageDate}
          </span>
        </div>
        <div className={styles.chatListItemSideWrap}>
          <div className={styles.arrowIcon}>
            <LinkIcon />
          </div>
          {onDelete && (
            <button 
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
        </div>
      </Link>
    </div>
  );
}