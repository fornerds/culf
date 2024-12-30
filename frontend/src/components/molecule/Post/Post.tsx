import React from 'react';
import styles from './Post.module.css';

interface PostProps {
  title: string;
  author: {
    profileImage?: string;
    name: string;
  };
  date: string;
  content: string;
}

export function Post({ title, author, date, content }: PostProps): JSX.Element {
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

      <div className={`${styles.content} font-text-2`}>
        {content}
      </div>
    </>
  );
}
