import * as Yup from 'yup';

export const emailSchema = Yup.string()
  .required('이메일은 필수 입력 사항입니다.')
  .email('올바른 이메일 형식을 입력하세요');
export const passwordSchema = Yup.string()
  .required('비밀번호를 입력해주세요')
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다');
export const nicknameSchema = Yup.string()
  .min(2, '닉네임은 최소 2자 이상이어야 합니다.')
  .required('닉네임은 필수 입력 사항입니다.');
export const phoneNumberSchema = Yup.string()
  .matches(/^\d{3}-\d{3,4}-\d{4}$/, '올바른 전화번호 형식을 입력하세요')
  .required('전화번호는 필수 입력 사항입니다.');

export const schemas: { [key: string]: Yup.StringSchema } = {
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
  phoneNumber: phoneNumberSchema,
};
