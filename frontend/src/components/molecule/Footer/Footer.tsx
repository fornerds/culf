import React from 'react';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.content} font-tag-2`}>
        <p className={styles.info}>상호 : 주식회사 버킷트래블</p>
        <p className={styles.info}>사업자등록번호 : 577-88-01749</p>
        <p className={styles.info}>주소 : 서울시 중구 청계천로 40, 1305호</p>
        <p className={styles.info}>
          고객센터 : 031-365-4520 / culf.help@gmail.com
        </p>
        <p className={styles.copyright}>©Cul.f. All rights reserved.</p>
      </div>
    </footer>
  );
}
