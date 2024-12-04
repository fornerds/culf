import * as Yup from 'yup';

export const emailSchema = Yup.string()
  .required('이메일을 입력하세요.')
  .email('올바른 이메일 형식을 입력하세요');
export const passwordSchema = Yup.string()
  .required('비밀번호를 입력하세요')
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다');
export const nicknameSchema = Yup.string()
  .required('닉네임을 입력하세요.')
  .min(2, '닉네임은 최소 2자 이상이어야 합니다.');
export const phoneNumberSchema = Yup.string()
  .required('휴대폰 번호를 입력하세요.')
  .matches(/^\d{10,11}$/, '올바른 전화번호 형식을 입력하세요. 예: 01012345678');
Yup.string();
export const birthDateSchema = Yup.string()
  .required('생년월일을 입력하세요.')
  .matches(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식으로 입력하세요.')
  .test('is-valid-date', '유효하지 않은 날짜입니다.', (value) => {
    if (!value) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const isValidDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return isValidDate && date <= new Date();
  });

export const schemas: { [key: string]: Yup.StringSchema } = {
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
  phoneNumber: phoneNumberSchema,
  birthDate: birthDateSchema,
};
