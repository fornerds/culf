// LoadingDots.tsx
import styles from './LoadingDots.module.css';

interface LoadingDotsProps {
  color?: string;
  size?: number;
}

export function LoadingDots({ color = '#8381FF', size = 7 }: LoadingDotsProps) {
  return (
    <div className={styles.loading}>
      <div
        className={styles.dot}
        style={{
          backgroundColor: color,
          width: size,
          height: size,
        }}
      />
      <div
        className={styles.dot}
        style={{
          backgroundColor: color,
          width: size,
          height: size,
        }}
      />
      <div
        className={styles.dot}
        style={{
          backgroundColor: color,
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
