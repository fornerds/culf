// src/pages/OAuthCallback.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProcessCallback } from '@/state/server/authQueries';
import { useAuthStore } from '@/state/client/authStore';
import { tokenService } from '@/utils/tokenService';
import styles from './OAuthCallback.module.css';

export function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider } = useParams<{ provider: string }>();
  const processCallback = useProcessCallback();
  const { setAuth, setSnsAuth } = useAuthStore();

  useEffect(() => {
    const processOAuth = async () => {
      try {
        const code = new URLSearchParams(location.search).get('code');
        if (!code || !provider) throw new Error('Missing parameters');

        const result = await processCallback.mutateAsync({ provider, code });

        if (result.type === 'success') {
          if (result.access_token && result.user) {
            tokenService.setAccessToken(result.access_token);
            // refresh_token은 백엔드가 쿠키로 설정함
            setAuth(true, result.user);
            navigate('/');
          }
        } else if (result.type === 'continue') {
          const providerInfo = document.cookie
            .split('; ')
            .find((row) => row.startsWith('provider_info='))
            ?.split('=')[1];

          if (providerInfo) {
            const decodedInfo = JSON.parse(atob(providerInfo.split('.')[1]));
            setSnsAuth(decodedInfo.provider, decodedInfo.provider_id);
          }
          navigate('/signup');
        }
      } catch (error) {
        console.error('OAuth callback failed:', error);
        navigate('/login');
      }
    };

    processOAuth();
  }, [
    location.search,
    provider,
    navigate,
    processCallback,
    setAuth,
    setSnsAuth,
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.loader}>로그인 처리중...</div>
    </div>
  );
}
