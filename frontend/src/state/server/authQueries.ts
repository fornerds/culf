import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { auth } from '../../api';
import { AxiosError } from 'axios';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface RegisterData {
  email: string;
  password: string;
  password_confirmation: string;
  nickname: string;
  phone_number: string;
  birthdate: string;
  gender: 'M' | 'F' | 'N';
  marketing_agreed: boolean;
}

interface SNSLoginData {
  provider: string;
  access_token: string;
}

interface SNSLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  isNewUser: boolean;
  need_additional_info: boolean;
}

interface FindEmailData {
  phone_number: string;
  birthdate: string;
}

interface FindEmailResponse {
  email: string;
}

interface PhoneVerificationData {
  phone_number: string;
}

interface PhoneVerificationResponse {
  message: string;
  expiration_time: number;
}

interface VerifyPhoneData {
  phone_number: string;
  verification_code: string;
}

interface VerifyPhoneResponse {
  message: string;
  is_verified: boolean;
}

interface ResetPasswordData {
  email: string;
  new_password: string;
  new_password_confirmation: string;
}

export const useLogin = (): UseMutationResult<
  LoginResponse,
  AxiosError,
  LoginCredentials
> =>
  useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      auth
        .login(credentials.email, credentials.password)
        .then((response) => response.data),
  });

export const useRegister = (): UseMutationResult<
  any,
  AxiosError,
  RegisterData
> =>
  useMutation({
    mutationFn: (data: RegisterData) =>
      auth.register(data).then((response) => response.data),
  });

export const useSNSLogin = (): UseMutationResult<
  SNSLoginResponse,
  AxiosError,
  SNSLoginData
> =>
  useMutation({
    mutationFn: (data: SNSLoginData) =>
      auth
        .loginSNS(data.provider, data.access_token)
        .then((response) => response.data),
  });

export const useFindEmail = (): UseMutationResult<
  FindEmailResponse,
  AxiosError,
  FindEmailData
> =>
  useMutation({
    mutationFn: (data: FindEmailData) =>
      auth
        .findEmail(data.phone_number, data.birthdate)
        .then((response) => response.data),
  });

export const useRequestPhoneVerification = (): UseMutationResult<
  PhoneVerificationResponse,
  AxiosError,
  PhoneVerificationData
> =>
  useMutation({
    mutationFn: (data: PhoneVerificationData) =>
      auth
        .requestPhoneVerification(data.phone_number)
        .then((response) => response.data),
  });

export const useVerifyPhone = (): UseMutationResult<
  VerifyPhoneResponse,
  AxiosError,
  VerifyPhoneData
> =>
  useMutation({
    mutationFn: (data: VerifyPhoneData) =>
      auth
        .verifyPhone(data.phone_number, data.verification_code)
        .then((response) => response.data),
  });

export const useResetPassword = (): UseMutationResult<
  void,
  AxiosError,
  ResetPasswordData
> =>
  useMutation({
    mutationFn: (data: ResetPasswordData) =>
      auth
        .resetPassword(
          data.email,
          data.new_password,
          data.new_password_confirmation,
        )
        .then((response) => response.data),
  });

export const useRefreshToken = (): UseMutationResult<
  LoginResponse,
  AxiosError,
  string
> =>
  useMutation({
    mutationFn: (refreshToken: string) =>
      auth.refreshToken(refreshToken).then((response) => response.data),
  });
