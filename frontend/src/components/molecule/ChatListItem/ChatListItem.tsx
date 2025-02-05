import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ChatListItem.module.css';
import LinkIcon from '@/assets/icons/link.svg?react';
import DeleteIcon from '@/assets/icons/delete.svg?react';

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
    e.preventDefault();
    e.stopPropagation();
    
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
          <div className={styles.chatInfoHeader}>
            <h3 className={`${styles.curatorName} font-button-2`}>{curatorName}</h3>
            <div className={styles.arrowIcon}>
              <LinkIcon />
            </div>
          </div>
          <p className={`${styles.lastMessage} font-text-4`}>{lastMessage}</p>
          <div className={styles.chatInfoFooter}>
            <span className={`${styles.lastMessageDate} font-tag-2`}>
              {lastMessageDate}
            </span>
            {onDelete && (
              <button 
                className={styles.deleteButton}
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label="채팅방 삭제"
              >
                {isDeleting ? '삭제 중...' : <DeleteIcon />}
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}