import { useAuthStore } from '@/state/client/authStore';
import styles from './Signup.module.css';
import { ChangeEvent, useEffect, useState } from 'react';
import { InputBox } from '@/components/molecule/InputBox';
import { schemas } from '@/utils/validation';
import { PhoneVerificationForm } from '@/components/molecule/PhoneVerificationForm';
import { Button, Label } from '@/components/atom';
import { RadioButton } from '@/components/atom/RadioButton';
import { auth } from '@/api';
import { useNavigate } from 'react-router-dom';
import { useRefreshToken } from '@/state/server/authQueries';

export function Signup() {
 const navigate = useNavigate();
 const refreshToken = useRefreshToken();
 const { isMarketingAgreed } = useAuthStore();
 const [form, setForm] = useState({
   nickname: '',
   email: '',
   birthDate: '',
   phoneNumber: '',
   gender: '',
   password: '',
   passwordConfirmation: '',
 });

 const [formMessage, setFormMessage] = useState({
   nickname: '',
   email: '',
   birthDate: '',
   phoneNumber: '',
   gender: '',
   password: '',
   passwordConfirmation: '',
 });
 
 const [isPhoneVerified, setIsPhoneVerified] = useState(false);
 const [isSnsSignup, setIsSnsSignup] = useState(false);

 useEffect(() => {
   const fetchSnsEmail = async () => {
     // provider_info 쿠키가 있는지 확인
     const hasProviderInfo = document.cookie
       .split('; ')
       .some(row => row.startsWith('provider_info='));

     if (hasProviderInfo) {
       setIsSnsSignup(true);
       try {
         const emailResponse = await auth.getProviderEmail();
         setForm(prev => ({
           ...prev,
           email: emailResponse.data.email
         }));
       } catch (error) {
         console.error('Failed to get provider email:', error);
         navigate('/beta/login'); // 에러 발생시 로그인 페이지로 리다이렉트
       }
     }
   };

   fetchSnsEmail();
 }, [navigate]);

 const genderOptions = [
   { label: '여성', id: 'F' },
   { label: '남성', id: 'M' },
   { label: '선택하지 않음', id: 'N' },
 ];

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
       setFormMessage(prev => ({ ...prev, [id]: '' }));
       return true;
     }
     return true;
   } catch (validationError: any) {
     setFormMessage((prev) => ({ ...prev, [id]: validationError.message }));
     return false;
   }
 };

 const handleFormChange = async (id: string, value: string) => {
   // SNS 회원가입시 이메일 변경 방지
   if (id === 'email' && isSnsSignup) {
     return;
   }

   setForm((prev) => ({
     ...prev,
     [id]: value,
   }));

   if (
     id === 'email' ||
     id === 'nickname' ||
     id === 'phoneNumber' ||
     id === 'passwordConfirmation'
   ) {
     validationCheck(id, value);
   }
 };

 const handleBlur = async (id: keyof typeof form) => {
   validationCheck(id, form[id]);
 };

 const handleRadioChange = (e: ChangeEvent<HTMLInputElement>) => {
   setForm((prev) => ({ ...prev, gender: e.target.id }));
 };

 const isFormValid = () => {
   return (
     Object.values(form).every((value) => value) &&
     Object.values(formMessage).every((message) => !message) &&
     isPhoneVerified
   );
 };

 const goCompleteSignupPage = () => {
   navigate('/complete-signup');
 };

 const handleRegister = async () => {
   try {
     const res = await auth.register({
       email: form.email,
       nickname: form.nickname,
       phone_number: form.phoneNumber,
       birthdate: form.birthDate,
       gender: form.gender,
       password: form.password,
       password_confirmation: form.passwordConfirmation,
       marketing_agreed: isMarketingAgreed,
     });
     
     if (res.status === 200) {
       await refreshToken.mutateAsync();
       goCompleteSignupPage();
     }
   } catch (error: any) {
     if (error.response?.data?.detail?.error === "validation_error") {
       alert(error.response.data.detail.message);
     } else {
       alert('회원가입이 실패했습니다.');
     }
     console.error(error);
   }
 };

 useEffect(() => {
   if (form.passwordConfirmation) {
     validationCheck('passwordConfirmation', form.passwordConfirmation);
   }
 }, [form.password]);

 return (
   <main className={styles.main}>
     <InputBox
       id="nickname"
       label="닉네임"
       placeholder="닉네임을 입력하세요"
       value={form.nickname}
       validationMessage={
         formMessage.nickname ||
         (form.nickname && '사용할 수 있는 닉네임입니다.')
       }
       validationMessageType={
         !form.nickname || formMessage.nickname ? 'error' : 'success'
       }
       onChangeObj={handleFormChange}
       onBlur={() => handleBlur('nickname')}
     />
     <div className={styles.inputGroup}>
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
         disabled={isSnsSignup}
       />
       <InputBox
         id="birthDate"
         label="생년월일"
         placeholder="생년월일을 입력하세요"
         value={form.birthDate}
         validationMessage={formMessage.birthDate}
         validationMessageType="error"
         onChangeObj={handleFormChange}
         onBlur={() => handleBlur('birthDate')}
       />
     </div>
     <PhoneVerificationForm
       phoneNumber={form.phoneNumber}
       isVerified={isPhoneVerified}
       onVerificationSuccess={() => setIsPhoneVerified(true)}
       validationMessage={formMessage.phoneNumber}
       onChangeObj={handleFormChange}
     />
     <div>
       <Label label="성별" id="gender" />
       {genderOptions.map((option) => (
         <RadioButton
           key={option.id}
           id={option.id}
           name="gender"
           label={option.label}
           onChange={handleRadioChange}
           checked={form.gender === option.id}
         />
       ))}
     </div>
     <div className={styles.inputGroup}>
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
       <InputBox
         id="passwordConfirmation"
         label="비밀번호 확인"
         type="password"
         placeholder="비밀번호를 입력하세요"
         value={form.passwordConfirmation}
         validationMessage={formMessage.passwordConfirmation}
         validationMessageType="error"
         onChangeObj={handleFormChange}
         onBlur={() => handleBlur('passwordConfirmation')}
       />
     </div>
     <div className={styles.buttonArea}>
       <Button
         variant={!isFormValid() ? 'disable' : 'default'}
         disabled={!isFormValid()}
         onClick={handleRegister}
       >
         가입하기
       </Button>
     </div>
   </main>
 );
}