import React from 'react';
import { useQuery } from '@tanstack/react-query';
import styles from './Footer.module.css';
import { Link } from '@/components/atom';
import { footer } from '@/api';

export function Footer() {
  const { data: footerData } = useQuery({
    queryKey: ['footer'],
    queryFn: async () => {
      const response = await footer.getFooter();
      return response.data;
    },
    retry: false,
  });

  return (
    <footer className={styles.footer}>
      <div className={`${styles.content} font-tag-2`}>
        <p className={styles.info}>상호 : {footerData?.company_name}</p>
        <p className={styles.info}>대표자 : {footerData?.ceo_name}</p>
        <p className={styles.info}>사업자등록번호 : {footerData?.business_number}</p>
        <p className={styles.info}>주소 : {footerData?.address}</p>
        <p className={styles.info}>
          고객센터 : {footerData?.customer_center_number} / {footerData?.email}
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