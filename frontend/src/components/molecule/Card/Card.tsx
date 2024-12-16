import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  frontColor: string;
  backColor: string;
  outlineColor: string;
  title: string;
  curator: string;
  hashtags: string[];
  characterImage: string;
  link: string;
}

export function Card({
  frontColor,
  backColor,
  outlineColor,
  title,
  curator,
  hashtags,
  characterImage,
  link,
}: CardProps) {
  const cardStyle = {
    backgroundColor: frontColor,
    border: `2px solid ${outlineColor}`,
  };

  const outlineStyle = {
    color: outlineColor
  };

  const hashtagStyle = {
    color: outlineColor,
    border: `1px solid ${outlineColor}`
  };

  return (
    <div className={styles.cardWrapper}>
      <div
        className={styles.cardBackground}
        style={{ backgroundColor: backColor, border: `2px solid ${outlineColor}` } }
      ></div>
      <div className={styles.card} style={cardStyle}>
        <div className={styles.cardContentWrap}>
          <h3 className={`${styles.title} font-card-title-1`} style={outlineStyle}>
            {title}
          </h3>
          <div className={styles.hashtags}>
            {hashtags.map((tag, index) => (
              <span 
                key={index} 
                className={`${styles.hashtag} font-tag-2`}
                style={hashtagStyle}
              >
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