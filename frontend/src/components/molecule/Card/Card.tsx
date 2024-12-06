import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  frontColor: string;
  backColor: string;
  title: string;
  curator: string;
  hashtags: string[];
  characterImage: string;
  link: string;
}

export function Card({
  frontColor,
  backColor,
  title,
  curator,
  hashtags,
  characterImage,
  link,
}: CardProps) {
  return (
    <div className={styles.cardWrapper}>
      <div
        className={styles.cardBackground}
        style={{ backgroundColor: backColor }}
      ></div>
      <div className={styles.card} style={{ backgroundColor: frontColor }}>
        <div className={styles.cardContentWrap}>
          <h3 className={`${styles.title} font-card-title-1`}>{title}<div>{curator}</div></h3>
          <div className={styles.hashtags}>
            {hashtags.map((tag, index) => (
              <span key={index} className={`${styles.hashtag} font-tag-2`}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <img
          src={characterImage}
          alt="Character"
          className={styles.character}
        />
      </div>
    </div>
  );
}
