import { useEffect, useState } from 'react';
import { InputBox } from '@/components/molecule/InputBox';
import styles from './PhoneVerificationForm.module.css';
import { auth } from '@/api';

interface PhoneVerificationFormProps {
  phoneNumber: string;
  findPw: boolean;
  isVerified: boolean;
  onVerificationSuccess: () => void;
  validationMessage?: string;
  onChangeObj?: (id: string, value: string) => void;
}

export function PhoneVerificationForm({
  phoneNumber,
  findPw,
  isVerified,
  onVerificationSuccess,
  validationMessage,
  onChangeObj,
}: PhoneVerificationFormProps) {
  const [showError, setShowError] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [phoneValidationMessage, setPhoneValidationMessage] = useState('');

  const validatePhoneNumber = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue !== value) {
      setPhoneValidationMessage('숫자만 입력 가능합니다.');
    } else if (value && value.length !== 11) {
      setPhoneValidationMessage('휴대폰 번호 11자리를 입력해주세요.');
    } else {
      setPhoneValidationMessage('');
    }
    return numericValue;
  };

  const handlePhoneNumberChange = (id: string, value: string) => {
    const validatedValue = validatePhoneNumber(value);
    // 새로운 번호 입력 시 에러 메시지 초기화
    if (phoneValidationMessage === '이미 사용 중인 휴대폰 번호입니다.') {
      setPhoneValidationMessage('');
    }
    if (onChangeObj) {
      onChangeObj(id, validatedValue);
    }
  };

  const handleBlur = () => {
    setShowError(true);
  };

  const handleRequestPhoneVerification = async () => {
    if (phoneNumber.length !== 11) {
      setPhoneValidationMessage('휴대폰 번호 11자리를 입력해주세요.');
      return;
    }

    try {
      setIsButtonDisabled(true);
      const res = await auth.requestPhoneVerification(phoneNumber, findPw);
      if (res.status === 200) {
        setTimeout(() => {
          setIsCodeSent(true);
          setIsButtonDisabled(false);
        }, 1000);
      }
    } catch (error: any) {
      // 에러 응답의 상태 코드가 400인 경우 이미 사용 중인 번호로 처리
      if (error.response?.status === 400) {
        setPhoneValidationMessage('이미 사용 중인 휴대폰 번호입니다.');
      } else {
        alert('인증번호 발송을 실패했습니다.');
      }
      setIsButtonDisabled(false);
    }
  };

  const handleVerificationCodeChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setVerificationCode(numericValue);
  };

  const handleVerifyPhone = async () => {
    try {
      const res = await auth.verifyPhone(phoneNumber, verificationCode);
      if (res.status === 200) {
        onVerificationSuccess();
      }
    } catch (e) {
      alert('인증번호가 올바르지 않습니다. 다시 시도해주세요.');
    }
  };

  const displayValidationMessage = showError ? phoneValidationMessage || validationMessage : '';

  return (
    <div>
      <InputBox
        id="phoneNumber"
        label="휴대폰 번호"
        placeholder="휴대폰 번호를 입력하세요 ('-' 없이 숫자만 입력)"
        value={phoneNumber}
        validationMessage={displayValidationMessage}
        validationMessageType="error"
        inputDisabled={isVerified}
        buttonSize="size4"
        buttonVariant={
          !phoneNumber || 
          phoneNumber.length !== 11 || 
          !!phoneValidationMessage || 
          isButtonDisabled || 
          isVerified
            ? 'disable'
            : 'default'
        }
        buttonDisabled={
          !phoneNumber || 
          phoneNumber.length !== 11 || 
          !!phoneValidationMessage || 
          isButtonDisabled || 
          isVerified
        }
        buttonText="인증번호 발송"
        onChangeObj={handlePhoneNumberChange}
        onClick={handleRequestPhoneVerification}
        onBlur={handleBlur}
      />
      <div className={styles.inputGroup}>
        <InputBox
          value={verificationCode}
          {...(isVerified && { validationMessage: '인증이 완료되었습니다.' })}
          validationMessageType="success"
          inputDisabled={!isCodeSent || isVerified}
          buttonSize="size4"
          buttonVariant={
            verificationCode.length !== 6 || isVerified ? 'disable' : 'default'
          }
          buttonDisabled={verificationCode.length !== 6 || isVerified}
          buttonText="인증하기"
          onChange={handleVerificationCodeChange}
          onClick={handleVerifyPhone}
          placeholder="인증번호 6자리 입력"
        />
      </div>
    </div>
  );
}