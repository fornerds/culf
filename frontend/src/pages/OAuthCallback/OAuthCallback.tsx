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
          navigate('/signup');
        }
      } catch (error) {
        console.error('OAuth callback processing failed:', error);
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