import { InputBox } from '@/components/molecule/InputBox';
import styles from './Login.module.css';
import { KeyboardEvent, useState, useEffect } from 'react';
import { Button, Link } from '@/components/atom';
import KakaoIcon from '@/assets/icons/kakao.svg?react';
import GoogleImage from '@/assets/images/google.png';
import { schemas } from '@/utils/validation';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '@/state/server/authQueries';
import { useAuthStore } from '@/state/client/authStore';
import { tokenService } from '@/utils/tokenService';
import { OAUTH } from '@/constants/oauth';

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [formMessage, setFormMessage] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const login = useLogin();
  const { setAuth } = useAuthStore();

  // 컴포넌트 마운트 시 세션 상태 확인
  useEffect(() => {
    // 이전 세션 토큰 확인 및 제거
    const existingToken = tokenService.getAccessToken();
    if (existingToken) {
      console.log('로그인 페이지에서 이전 세션 토큰 감지 - 초기화 진행');
      tokenService.removeAccessToken();
    }

    // 디버깅용: 세션 초기 상태 확인
    console.log('로그인 페이지 로드 - 세션 상태:', {
      hasToken: !!tokenService.getAccessToken(),
      isAuthenticated: useAuthStore.getState().isAuthenticated,
    });
  }, []);

  const handleFormChange = (id: string, value: string) => {
    setForm((prev) => ({ ...prev, [id]: value }));
    setFormMessage((prev) => ({ ...prev, [id]: '' }));
  };

  const handleBlur = async (id: keyof typeof form) => {
    try {
      await schemas[id]?.validate(form[id]);
    } catch (error: any) {
      setFormMessage((prev) => ({ ...prev, [id]: error.message }));
    }
  };

  const handleLogin = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // 입력값 검증
      await handleBlur('email');
      await handleBlur('password');

      if (formMessage.email || formMessage.password) {
        setIsSubmitting(false);
        return;
      }

      console.log('로그인 요청 중...');

      // 로그인 요청
      const result = await login.mutateAsync(form);

      if (result.access_token && result.user) {
        console.log('로그인 성공, 세션 설정 중...');

        // 중요: 토큰을 먼저 저장 (sessionStorage에)
        tokenService.setAccessToken(result.access_token);

        // 인증 상태 확인
        console.log('세션 토큰 저장 후 확인:', {
          token: tokenService.getAccessToken(),
          tokenExists: !!tokenService.getAccessToken(),
        });

        // 그런 다음 인증 상태 업데이트
        setAuth(true, result.user, result.access_token);

        // 상태 업데이트 확인
        console.log('인증 상태 업데이트 후:', {
          isAuthenticated: useAuthStore.getState().isAuthenticated,
          user: useAuthStore.getState().user,
        });

        // 로그인 완료 후 홈으로 이동
        console.log('로그인 완료, 홈으로 이동');
        navigate('/');
      } else {
        console.error('로그인 응답에 토큰이나 사용자 정보가 없습니다:', result);
        alert('로그인 정보가 유효하지 않습니다.');
      }
    } catch (error) {
      console.error('로그인 실패:', error);
      alert('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const handleSnsLogin = (provider: 'kakao' | 'google') => {
    console.log(`${provider} 로그인 시작`);
    if (provider === 'kakao') {
      window.location.href = OAUTH.KAKAO.REDIRECT_URI;
    } else {
      window.location.href = OAUTH.GOOGLE.REDIRECT_URI;
    }
  };

  return (
    <main className={styles.main}>
      <div className="font-title-1">반갑습니다!</div>
      <div onKeyDown={handleKeyDown}>
        <div className={styles.inputWrapper}>
          <InputBox
            id="email"
            label="이메일"
            type="email"
            placeholder="이메일을 입력하세요"
            value={form.email}
            validationMessage={formMessage.email}
            validationMessageType="error"
            onChangeObj={handleFormChange}
            onBlur={() => handleBlur('email')}
          />
          <InputBox
            id="password"
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={form.password}
            validationMessage={formMessage.password}
            validationMessageType="error"
            onChangeObj={handleFormChange}
            onBlur={() => handleBlur('password')}
          />
        </div>
        <div className={styles.buttonArea}>
          <Button onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인하기'}
          </Button>
        </div>
      </div>
      <div className={styles.linkWrapper}>
        <Link to="/terms">
          <span>회원가입</span>
        </Link>
        <div className={styles.linkRight}>
          <Link to="/find-email">
            <span>이메일 찾기</span>
          </Link>
          <span>|</span>
          <Link to="/change-password">
            <span>비밀번호 찾기</span>
          </Link>
        </div>
      </div>
      <div className={styles.bottom}>
        <div className={styles.bottomText}>
          <span>간편 로그인</span>
        </div>
        <div className={styles.buttonGroup}>
          <button
            className={styles.kakaoBtn}
            onClick={() => handleSnsLogin('kakao')}
          >
            <KakaoIcon />
            <span className="font-button-1">카카오 로그인</span>
          </button>
          <button
            className={styles.googleBtn}
            onClick={() => handleSnsLogin('google')}
          >
            <img src={GoogleImage} width="16px" height="17px" alt="Google" />
            <span className="font-button-1">구글 로그인</span>
          </button>
        </div>
      </div>
    </main>
  );
}
