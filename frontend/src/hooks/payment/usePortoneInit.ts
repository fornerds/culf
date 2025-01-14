// hooks/payment/usePortoneInit.ts
import { useEffect, useState } from 'react';
import { PAYMENT_CONFIG } from '@/config/payment';

declare global {
  interface Window {
    IMP: any;
  }
}

export const usePortoneInit = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializePortone = () => {
      if (window.IMP) {
        console.log('Initializing Portone with code:', PAYMENT_CONFIG.portone.impCode);
        window.IMP.init(PAYMENT_CONFIG.portone.impCode);
        setIsInitialized(true);
      }
    };

    // 스크립트가 이미 로드되어 있는지 확인
    const existingScript = document.querySelector('script[src="https://cdn.iamport.kr/v1/iamport.js"]');
    
    if (existingScript) {
      console.log('Portone script already exists');
      if (window.IMP) {
        initializePortone();
      } else {
        // 스크립트는 있지만 아직 로드가 완료되지 않은 경우
        existingScript.addEventListener('load', initializePortone);
      }
      return;
    }

    console.log('Loading Portone script...');
    // 스크립트 로드
    const script = document.createElement('script');
    script.src = 'https://cdn.iamport.kr/v1/iamport.js';
    script.async = true;
    script.onload = () => {
      console.log('Portone script loaded');
      initializePortone();
    };
    document.body.appendChild(script);

    return () => {
      if (existingScript) {
        existingScript.removeEventListener('load', initializePortone);
      }
    };
  }, []);

  return isInitialized;
};