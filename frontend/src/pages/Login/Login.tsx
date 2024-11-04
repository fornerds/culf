import { InputBox } from '@/components/molecule/InputBox';
import styles from './Login.module.css';
import { useState } from 'react';
import { Button, Link } from '@/components/atom';
import NaverIcon from '@/assets/icons/naver.svg?react';
import KakaoIcon from '@/assets/icons/kakao.svg?react';

export function Login() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [emailMessage, setEmailMessage] = useState('');

  const handleFormChange = (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
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
            validationMessage={emailMessage}
            validationMessageType="error"
            onChangeObj={handleFormChange}
          />
          <InputBox
            id="password"
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={form.password}
            onChangeObj={handleFormChange}
          />
        </div>
        <div className={styles.buttonArea}>
          <Button>로그인하기</Button>
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
