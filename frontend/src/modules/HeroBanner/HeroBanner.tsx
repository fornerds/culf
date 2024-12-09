import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './HeroBanner.module.css';

export type SlideItem = {
  imageUrl: string;
  link: string;
};

export type HeroBannerProps = {
  slides: SlideItem[];
};

export function HeroBanner({ slides }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const renderSlide = (slide: SlideItem, index: number) => {
    const slideClassName = `${styles.slide} ${index === currentIndex ? styles.active : ''}`;
    
    if (slide.link.startsWith('http')) {
      return (
        <div key={index} className={slideClassName}>
          <a 
            href={slide.link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.slideLink}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={slide.imageUrl} alt={`Slide ${index + 1}`} />
          </a>
        </div>
      );
    }

    return (
      <div key={index} className={slideClassName}>
        <Link to={slide.link} className={styles.slideLink}>
          <img src={slide.imageUrl} alt={`Slide ${index + 1}`} />
        </Link>
      </div>
    );
  };

  return (
    <div className={styles.sliderContainer}>
      <div className={styles.slidesWrapper}>
        {slides.map((slide, index) => renderSlide(slide, index))}
      </div>
      <div className={styles.indicators}>
        {slides.map((_, index) => (
          <button
            key={index}
            className={`${styles.indicator} ${index === currentIndex ? styles.active : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}