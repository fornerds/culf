import React from 'react';
import styles from './Footer.module.css';
import { Link } from '@/components/atom';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.content} font-tag-2`}>
        <p className={styles.info}>상호 : 주식회사 버킷트래블</p>
        <p className={styles.info}>대표자 : 명선아</p>
        <p className={styles.info}>사업자등록번호 : 577-88-01749</p>
        <p className={styles.info}>주소 : 서울시 중구 청계천로 40, 1305호</p>
        <p className={styles.info}>
          고객센터 : 031-365-4520 / culf.help@gmail.com
        </p>
        <div className={styles.linkWrap}>
          <Link 
            className={styles.link} 
            to='https://buckettravel.notion.site/0cbb2041884048f188cdfc8bc6def7cc?pvs=4'
            target="_blank"
            rel="noopener noreferrer"
          >
            이용약관
          </Link>
          <Link 
            className={styles.link} 
            to='https://buckettravel.notion.site/e260ac1b5c524993944e9b2371b4f6b9?pvs=4'
            target="_blank"
            rel="noopener noreferrer"
          >
            개인정보 처리방침
          </Link>
        </div>
        <p className={styles.copyright}>©Cul.f. All rights reserved.</p>
      </div>
    </footer>
  );
}