import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';
import { tokenService } from '@/utils/tokenService';
import { auth } from '@/api';
import styles from './OAuthCallback.module.css';

export function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const loginStatus = document.cookie
          .split('; ')
          .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
          ?.split('=')[1];

        if (loginStatus === 'success') {
          const refreshResponse = await auth.refreshToken();
          const { access_token, user } = refreshResponse.data;
          tokenService.setAccessToken(access_token);
          setAuth(true, user);
          navigate('/');
        } 
        else if (loginStatus === 'continue') {
          // continue 상태일 때는 토큰 관련 작업을 하지 않고 바로 약관 페이지로 이동
          tokenService.removeAccessToken(); // 혹시 남아있을 수 있는 토큰 제거
          setAuth(false, null); // 인증 상태 초기화
          navigate('/terms');
          return;
        }
      } catch (error) {
        console.error('OAuth callback processing failed:', error);
        tokenService.removeAccessToken();
        setAuth(false, null);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, setAuth]);

  return (
    <div className={styles.container}>
      <div className={styles.loader}>로그인 처리중...</div>
    </div>
  );
}