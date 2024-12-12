import React from 'react';
import styles from './LoadingAnimation.module.css';

interface LoadingAnimationProps {
  imageUrl: string;
  alt: string;
  width?: number;
  height?: number;
  duration?: number;
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  imageUrl,
  alt,
  width = 256,
  height = 256,
  duration = 2000,
}) => {
  return (
    <div 
      className={styles.container}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <div className={styles.imageWrapper}>
        <img 
          src={imageUrl}
          alt={alt}
          className={styles.image}
        />
        <div 
          className={styles.overlay}
          style={{ 
            '--animation-duration': `${duration}ms`
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
};