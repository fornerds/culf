import { InputBox } from '@/components/molecule/InputBox';
import styles from './ChangePassword.module.css';
import { Button } from '@/components/atom';
import { useState } from 'react';
import { schemas } from '@/utils/validation';
import { PhoneVerificationForm } from '@/components/molecule/PhoneVerificationForm';
import { auth } from '@/api';
import { Popup } from '@/components/molecule';
import { useNavigate } from 'react-router-dom';

export function ChangePassword() {
  const navigate = useNavigate();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  });
  const [formMessage, setFormMessage] = useState({
    phoneNumber: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  });

  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const validationCheck = async (id: string, value: string) => {
    try {
      if (id === 'passwordConfirmation') {
        if (form.password !== value) {
          setFormMessage((prev) => ({
            ...prev,
            passwordConfirmation: '입력한 비밀번호와 다릅니다.',
          }));
          return false;
        } else {
          setFormMessage((prev) => ({
            ...prev,
            passwordConfirmation: '',
          }));
          return true;
        }
      }

      const schema = schemas[id];
      if (schema) {
        await schema.validate(value);
        setFormMessage((prev) => ({ ...prev, [id]: '' }));
        return true;
      }
      return true;
    } catch (validationError: any) {
      setFormMessage((prev) => ({ ...prev, [id]: validationError.message }));
      return false;
    }
  };

  const handleFormChange = async (id: string, value: string) => {
    setForm({
      ...form,
      [id]: value,
    });
    setFormMessage({
      ...formMessage,
      [id]: '',
    });

    if (id !== 'password') {
      validationCheck(id, value);
    }
  };

  const handleBlur = async (id: keyof typeof form) => {
    validationCheck(id, form[id]);
  };

  const isFormValid = () => {
    return (
      Object.values(form).every((value) => value) &&
      Object.values(formMessage).every((message) => !message) &&
      isPhoneVerified
    );
  };

  const hanelFindEmail = async () => {
    try {
      const res = await auth.resetPassword(
        form.email,
        form.phoneNumber,
        form.password,
        form.passwordConfirmation,
      );
      if (res.status === 200) {
        setIsAlertOpen(true);
      }
    } catch (e) {
      alert('비밀번호 변경을 실패했습니다.');
    }
  };

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-1">비밀번호 변경</div>
        <div className={styles.inputGroup}>
          <PhoneVerificationForm
            phoneNumber={form.phoneNumber}
            findPw={true}
            isVerified={isPhoneVerified}
            onVerificationSuccess={() => setIsPhoneVerified(true)}
            validationMessage={formMessage.phoneNumber}
            onChangeObj={handleFormChange}
          />
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
          <div className={styles.inputGroupPwd}>
            <InputBox
              id="password"
              label="신규 비밀번호"
              type="password"
              placeholder="비밀번호를 입력하세요"
              inputDisabled={!isPhoneVerified}
              value={form.password}
              validationMessage={formMessage.password}
              validationMessageType="error"
              onChangeObj={handleFormChange}
              onBlur={() => handleBlur('password')}
            />
            <InputBox
              id="passwordConfirmation"
              label="신규 비밀번호 확인"
              type="password"
              placeholder="비밀번호를 입력하세요"
              inputDisabled={!isPhoneVerified}
              value={form.passwordConfirmation}
              validationMessage={formMessage.passwordConfirmation}
              validationMessageType="error"
              onChangeObj={handleFormChange}
              onBlur={() => handleBlur('passwordConfirmation')}
            />
          </div>
        </div>
        <div className={styles.buttonArea}>
          <Button
            variant={!isFormValid() ? 'disable' : 'default'}
            disabled={!isFormValid()}
            onClick={hanelFindEmail}
          >
            비밀번호 변경하기
          </Button>
        </div>
      </main>
      <Popup
        type="alert"
        isOpen={isAlertOpen}
        onClose={() => {
          navigate('/login');
          setIsAlertOpen(false);
        }}
        content="비밀번호가 변경되었습니다."
        confirmText="확인"
      />
    </>
  );
}
