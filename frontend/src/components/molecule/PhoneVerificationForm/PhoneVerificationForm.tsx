import { useState } from 'react';
import { InputBox } from '@/components/molecule/InputBox';
import styles from './PhoneVerificationForm.module.css';

interface PhoneVerificationFormProps {
  phoneNumber: string;
  onChangeObj?: (id: string, value: string) => void;
}

export function PhoneVerificationForm({
  phoneNumber,
  onChangeObj,
}: PhoneVerificationFormProps) {
  const [phoneNumberMessage, setPhoneNumberMessage] = useState('');

  const [verificationCode, setVerificationCode] = useState('');
  const [verificationCodeMessage, setVerificationCodeMessage] = useState('');

  const handleVerificationCodeChange = (value: string) => {
    setVerificationCode(value);
    console.log('인증번호 정책 확인');
  };
  return (
    <div>
      <InputBox
        id="phoneNumber"
        label="휴대폰 번호"
        placeholder="010-0000-0000"
        value={phoneNumber}
        buttonSize="size4"
        buttonVariant="default"
        buttonText="인증번호 발송"
        onChangeObj={onChangeObj}
      />
      <div className={styles.inputGroup}>
        <InputBox
          value={verificationCode}
          disabled={true}
          buttonSize="size4"
          buttonVariant="disable"
          buttonText="인증하기"
          onChange={handleVerificationCodeChange}
        />
      </div>
    </div>
  );
}
