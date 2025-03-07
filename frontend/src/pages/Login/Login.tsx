import { InputBox } from '@/components/molecule/InputBox';
import styles from './Login.module.css';
import { KeyboardEvent, useState } from 'react';
import { Button, Link } from '@/components/atom';
import KakaoIcon from '@/assets/icons/kakao.svg?react';
import GoogleImage from '@/assets/images/google.png';
import { schemas } from '@/utils/validation';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '@/state/server/authQueries';
import { useAuthStore } from '@/state/client/authStore';
import { OAUTH } from '@/constants/oauth';

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [formMessage, setFormMessage] = useState({ email: '', password: '' });
  const navigate = useNavigate();
  const login = useLogin();
  const { setAuth } = useAuthStore();

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
    try {
      await handleBlur('email');
      await handleBlur('password');
      const { access_token, refresh_token, user } =
        await login.mutateAsync(form);
      setAuth(true, user, access_token, refresh_token);
      navigate('/');
    } catch {
      alert('로그인에 실패했습니다.');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };
  const handleSnsLogin = (provider: 'kakao' | 'google') => {
    if (provider === 'kakao') {
      window.location.href = OAUTH.KAKAO.REDIRECT_URI;
    } else {
      // Google OAuth 로직 추가 필요
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
          <Button onClick={handleLogin}>로그인하기</Button>
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
