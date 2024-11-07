import { InputBox } from '@/components/molecule/InputBox';
import styles from './Login.module.css';
import { useState } from 'react';
import { Button, Link } from '@/components/atom';
import NaverIcon from '@/assets/icons/naver.svg?react';
import KakaoIcon from '@/assets/icons/kakao.svg?react';
import { schemas } from '@/utils/validation';
import { useLogin } from '@/state/server/authQueries';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [formMessage, setFormMessage] = useState({
    email: '',
    password: '',
  });
  const navigate = useNavigate();
  const { mutate: login } = useLogin();

  const handleFormChange = async (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
    setFormMessage({
      ...formMessage,
      [id]: '',
    });
  };

  const handleBlur = async (id: keyof typeof form) => {
    try {
      const schema = schemas[id];
      if (schema) {
        await schema.validate(form[id]);
      }
    } catch (validationError: any) {
      setFormMessage((prev) => ({ ...prev, [id]: validationError.message }));
    }
  };

  const handleLogin = async () => {
    handleBlur('email');
    handleBlur('password');
    await login(
      { ...form },
      {
        onSuccess: (data) => {
          sessionStorage.setItem('accessToken', data.access_token);
          navigate('/');
        },
        onError: (error) => {
          alert('로그인에 실패했습니다.');
        },
      },
    );
  };

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-1">반갑습니다!</div>
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
        <div className={styles.linkWrapper}>
          <Link to="/signup">
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
            <div className={styles.naverBtn}>
              <NaverIcon />
              <span>네이버 로그인</span>
            </div>
            <div className={styles.kakaoBtn}>
              <KakaoIcon />
              <span>카카오 로그인</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
