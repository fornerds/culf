import { Button } from '@/components/atom';
import { useState } from 'react';
import styles from './Account.module.css';
import { InputBox } from '@/components/molecule/InputBox';
import { PhoneVerificationForm } from '@/components/molecule/PhoneVerificationForm';
import { useNavigate } from 'react-router-dom';

export function Account() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    nickname: '',
    phoneNumber: '',
    password: '',
    newPassword: '',
  });
  const [emailMessage, setEmailMessage] = useState('');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [newPasswordCheck, setNewPasswordCheck] = useState('');

  const handleFormChange = (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
  };

  const handlePasswordCheckClick = () => {
    setIsPasswordValid(!isPasswordValid);
  };

  const handleNewPasswordCheckChange = (value: string) => {
    setNewPasswordCheck(value);
  };

  return (
    <>
      <main>
        <div className={styles.accountContent}>
          {/* TODO: 이메일, 닉네임 input 다른 페이지에서도 사용 => 컴포넌트화? */}
          <InputBox
            id="email"
            label="이메일"
            type="email"
            placeholder="example@gmail.com"
            value={form.email}
            validationMessage={emailMessage}
            validationMessageType="error"
            onChangeObj={handleFormChange}
          />
          <InputBox
            id="nickname"
            label="닉네임"
            placeholder="닉네임 입력"
            value={form.nickname}
            onChangeObj={handleFormChange}
          />
          <PhoneVerificationForm
            phoneNumber={form.phoneNumber}
            onChangeObj={handleFormChange}
          />
          <section className={styles.passwordSection}>
            <InputBox
              id="changePassword"
              label="비밀번호 변경"
              placeholder="기존 비밀번호 입력"
              value={form.password}
              buttonSize="size4"
              buttonVariant="default"
              buttonText="확인"
              onChangeObj={handleFormChange}
              onClick={handlePasswordCheckClick}
            />
            {isPasswordValid && (
              <>
                <InputBox
                  id="newPassword"
                  label="신규 비밀번호"
                  placeholder="비밀번호 입력"
                  value={form.newPassword}
                  onChangeObj={handleFormChange}
                />
                <InputBox
                  id="newPasswordCheck"
                  label="신규 비밀번호 확인"
                  placeholder="기존 비밀번호 입력"
                  value={newPasswordCheck}
                  onChange={handleNewPasswordCheckChange}
                />
              </>
            )}
          </section>
        </div>
        <div className={styles.accountBottom}>
          <Button>변경사항 저장</Button>
          <div className={styles.buttonGroup}>
            <Button
              size="size3"
              variant="warning"
              onClick={() => navigate('/delete-account')}
            >
              계정탈퇴하기
            </Button>
            <Button size="size3" variant="less-highlight">
              로그아웃
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
