import { InputBox } from '@/components/molecule/InputBox';
import styles from './FindEmail.module.css';
import { useState } from 'react';
import { schemas } from '@/utils/validation';
import { Button } from '@/components/atom';

export function FindEmail() {
  const [form, setForm] = useState({
    phoneNumber: '',
    birthDate: '',
  });
  const [formMessage, setFormMessage] = useState({
    phoneNumber: '',
    birthDate: '',
  });

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

  const hanelFindEmail = async () => {};

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
            placeholder="생년월일을 입력하세요"
            value={form.birthDate}
            validationMessage={formMessage.birthDate}
            validationMessageType="error"
            onChangeObj={handleFormChange}
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
