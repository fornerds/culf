import { useEffect, useState } from 'react';
import { InputBox } from '@/components/molecule/InputBox';
import styles from './PhoneVerificationForm.module.css';
import { auth } from '@/api';

interface PhoneVerificationFormProps {
  phoneNumber: string;
  isVerified: boolean;
  onVerificationSuccess: () => void;
  validationMessage?: string;
  onChangeObj?: (id: string, value: string) => void;
}

export function PhoneVerificationForm({
  phoneNumber,
  isVerified,
  onVerificationSuccess,
  validationMessage,
  onChangeObj,
}: PhoneVerificationFormProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleRequestPhoneVerification = async () => {
    try {
      const res = await auth.requestPhoneVerification(
        phoneNumber.replace(/-/g, ''),
      );
      if (res.status === 200) {
        // alert('인증번호가 발송되었습니다.');
        setIsButtonDisabled(true);

        setTimeout(() => {
          setIsCodeSent(true);
          setCountdown(60); // 1분 동안 인증번호 재요청 불가
        }, 1000);
      }
    } catch (e) {
      alert('인증번호 발송을 실패했습니다.');
      setIsCodeSent(true);
    }
  };

  const handleVerificationCodeChange = (value: string) => {
    setVerificationCode(value);
  };

  const handleVerifyPhone = async () => {
    const res = await auth.verifyPhone(
      phoneNumber.replace(/-/g, ''),
      verificationCode,
    );
    if (res.status === 200) {
      onVerificationSuccess();
    }
  };

  useEffect(() => {
    if (countdown === 0) {
      setIsButtonDisabled(false); // 1분 후 버튼 활성화
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <div>
      <InputBox
        id="phoneNumber"
        label="휴대폰 번호"
        placeholder="휴대폰 번호를 입력하세요"
        value={phoneNumber}
        validationMessage={validationMessage}
        validationMessageType="error"
        inputDisabled={isVerified}
        buttonSize="size4"
        buttonVariant={
          !phoneNumber || !!validationMessage || isButtonDisabled || isVerified
            ? 'disable'
            : 'default'
        }
        buttonDisabled={
          !phoneNumber || !!validationMessage || isButtonDisabled || isVerified
        }
        buttonText="인증번호 발송"
        onChangeObj={onChangeObj}
        onClick={handleRequestPhoneVerification}
      />
      <div className={styles.inputGroup}>
        <InputBox
          value={verificationCode}
          inputDisabled={!isCodeSent || isVerified}
          buttonSize="size4"
          buttonVariant={
            verificationCode.length !== 6 || isVerified ? 'disable' : 'default'
          }
          buttonDisabled={verificationCode.length !== 6 || isVerified}
          buttonText="인증하기"
          onChange={handleVerificationCodeChange}
          onClick={handleVerifyPhone}
        />
      </div>
    </div>
  );
}
