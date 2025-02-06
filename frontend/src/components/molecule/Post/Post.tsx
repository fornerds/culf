import React from 'react';
import styles from './Post.module.css';
import DOMPurify from 'dompurify';

interface PostProps {
  title: string;
  author: {
    profileImage?: string;
    name: string;
  };
  date: string;
  content: string;
  contentType?: 'text' | 'html';
}

export function Post({ title, author, date, content, contentType = 'text' }: PostProps): JSX.Element {
  const renderContent = () => {
    if (contentType === 'html') {
      // HTML 문자열을 안전하게 sanitize
      const sanitizedContent = DOMPurify.sanitize(content);
      return (
        <div 
          className={`${styles.content} font-text-2`}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      );
    }
    
    // 기존 텍스트 형식
    return (
      <div className={`${styles.content} font-text-2`}>
        {content}
      </div>
    );
  };

  return (
    <>
      <h1 className={`${styles.title} font-title-3`}>{title}</h1>
      
      <div className={styles.authorContainer}>
        <div className={styles.authorProfile}>
          {author.profileImage ? (
            <img 
              src={author.profileImage} 
              alt={`${author.name}'s profile`} 
              className={styles.profileImage}
            />
          ) : (
            <div className={styles.defaultProfile} />
          )}
        </div>
        <div className={styles.authorInfo}>
          <span className={`${styles.authorName} font-text-4`}>{author.name}</span>
          <span className={`${styles.date} font-tag-2`}>{date}</span>
        </div>
      </div>

      {renderContent()}
    </>
  );
}