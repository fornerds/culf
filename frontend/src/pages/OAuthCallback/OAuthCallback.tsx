import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProcessCallback } from '@/state/server/authQueries';
import { useAuthStore } from '@/state/client/authStore';
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

        if (
          result.type === 'success' &&
          result.access_token &&
          result.refresh_token
        ) {
          setAuth(true, result.user, result.access_token, result.refresh_token);
          navigate('/');
        } else {
          const providerInfo = document.cookie
            .split('; ')
            .find((row) => row.startsWith('provider_info='))
            ?.split('=')[1];

          if (providerInfo) {
            const { provider: p, provider_id } = JSON.parse(
              atob(providerInfo.split('.')[1]),
            );
            setSnsAuth(p, provider_id);
          }
          navigate('/signup');
        }
      } catch (error) {
        console.error('OAuth callback failed:', error);
        navigate('/login');
      }
    };

    processOAuth();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.loader}>로그인 처리중...</div>
    </div>
  );
}
