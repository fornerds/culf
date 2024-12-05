import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/state/client/authStore';
import { tokenService } from '@/utils/tokenService';
import { auth } from '@/api';
import styles from './OAuthCallback.module.css';

export function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth, setSnsAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 모든 쿠키 로깅
        console.log('All cookies:', document.cookie);

        const loginStatus = document.cookie
          .split('; ')
          .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
          ?.split('=')[1];

        console.log('Login status:', loginStatus);

        if (!loginStatus) {
          throw new Error('Authentication status not found');
        }

        if (loginStatus === 'success') {
          console.log('Processing success case');
          const refreshResponse = await auth.refreshToken();
          console.log('Refresh response:', refreshResponse.data);

          const { access_token, user } = refreshResponse.data;
          tokenService.setAccessToken(access_token);
          setAuth(true, user);
          navigate('/');
        } 
        else if (loginStatus === 'continue') {
          console.log('Processing continue case');
          const providerInfo = document.cookie
            .split('; ')
            .find((row) => row.startsWith('provider_info='))
            ?.split('=')[1];

          console.log('Provider info:', providerInfo);

          if (providerInfo) {
            const decodedInfo = JSON.parse(atob(providerInfo.split('.')[1]));
            console.log('Decoded provider info:', decodedInfo);

            setSnsAuth(decodedInfo.provider, decodedInfo.provider_id);

            try {
              const emailResponse = await auth.getProviderEmail();
              console.log('Email response:', emailResponse.data);

              navigate('/signup', { 
                state: { 
                  email: emailResponse.data.email,
                  isOAuthSignup: true 
                } 
              });
            } catch (emailError) {
              console.error('Error getting provider email:', emailError);
            }
          } else {
            console.error('No provider info found in cookies');
          }
        }
      } catch (error) {
        console.error('OAuth callback processing failed:', error);
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate, setAuth, setSnsAuth]);

  return (
    <div className={styles.container}>
      <div className={styles.loader}>로그인 처리중...</div>
    </div>
  );
}