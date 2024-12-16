import { InputBox } from '@/components/molecule/InputBox';
import styles from './FindEmail.module.css';
import { useState } from 'react';
import { schemas } from '@/utils/validation';
import { Button } from '@/components/atom';
import { useFindEmail } from '@/state/server/authQueries';
import useModalStore from '@/state/client/useModalStore';
import { useNavigate } from 'react-router-dom';

export function FindEmail() {
  const findEmail = useFindEmail();
  const navigate = useNavigate();
  const { showModal } = useModalStore();
  const [form, setForm] = useState({
    phoneNumber: '',
    birthDate: '',
  });
  const [formMessage, setFormMessage] = useState({
    phoneNumber: '',
    birthDate: '',
  });

  const formatBirthDate = (value: string) => {
    // Remove any non-digit characters
    const numbers = value.replace(/\D/g, '');

    // Don't allow more than 8 digits
    if (numbers.length > 8) return form.birthDate;

    // Format as YYYY-MM-DD
    if (numbers.length >= 4 && numbers.length < 6) {
      return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    } else if (numbers.length >= 6) {
      return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
    }
    return numbers;
  };

  const validationCheck = async (id: string, value: string) => {
    try {
      const schema = schemas[id];
      if (schema) {
        await schema.validate(value);
      }
      return true;
    } catch (validationError: any) {
      setFormMessage((prev) => ({ ...prev, [id]: validationError.message }));
      return false;
    }
  };

  const handleFormChange = async (id: string, value: string) => {
    // Format birthDate input
    if (id === 'birthDate') {
      value = formatBirthDate(value);
    }

    setForm({
      ...form,
      [id]: value,
    });
    setFormMessage({
      ...formMessage,
      [id]: '',
    });

    validationCheck(id, value);
  };

  const isFormValid = () => {
    return (
      Object.values(form).every((value) => value) &&
      Object.values(formMessage).every((message) => !message)
    );
  };

  const hanelFindEmail = async () => {
    try {
      const res = await findEmail.mutateAsync({
        phoneNumber: form.phoneNumber,
        birthdate: form.birthDate,
      });
      showModal('회원님의 이메일 주소입니다.', res.data.email, undefined, () =>
        navigate('/login'),
      );
    } catch (e) {
      alert('실패했습니다.');
    }
  };

  return (
    <>
      <main className={styles.main}>
        <div className="font-title-1">이메일 찾기</div>
        <div className={styles.inputGroup}>
          <InputBox
            id="phoneNumber"
            label="휴대폰 번호"
            placeholder="휴대폰 번호를 입력하세요"
            value={form.phoneNumber}
            validationMessage={formMessage.phoneNumber}
            validationMessageType="error"
            onChangeObj={handleFormChange}
          />
          <InputBox
            id="birthDate"
            label="생년월일"
            placeholder="YYYY-MM-DD"
            value={form.birthDate}
            validationMessage={formMessage.birthDate}
            validationMessageType="error"
            onChangeObj={handleFormChange}
            maxLength={10}
          />
        </div>
        <div className={styles.buttonArea}>
          <Button
            variant={!isFormValid() ? 'disable' : 'default'}
            disabled={!isFormValid()}
            onClick={hanelFindEmail}
          >
            이메일 찾기
          </Button>
        </div>
      </main>
    </>
  );
}
