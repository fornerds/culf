// src/state/server/authQueries.ts
import { useState } from 'react';
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { auth } from '../../api/index';
import { useAuthStore } from '../client/authStore';
import { tokenService } from '@/utils/tokenService';
import { AxiosError } from 'axios';

interface User {
  id: string;
  email: string;
  nickname: string;
}

interface LoginCredentials {
  email: string;
  password: string;
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

interface PhoneVerificationData {
  phone_number: string;
}

interface PasswordResetData {
  email: string;
  new_password: string;
  new_password_confirmation: string;
}

interface ProcessCallbackResponse {
  type: 'success' | 'continue';
  access_token?: string;
  refresh_token?: string;
  email?: string;
  user?: {
    id: string;
    email: string;
    nickname: string;
  };
}

export const useLogin = (): UseMutationResult<
  { access_token: string; user: User },
  AxiosError,
  LoginCredentials
> =>
  useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      auth.login(credentials.email, credentials.password),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      tokenService.setAccessToken(access_token);
      useAuthStore.getState().setAuth(true, user);
    },
  });

export const useLogout = () =>
  useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      // 토큰 제거
      tokenService.removeAccessToken();
      // 상태 초기화
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
    },
    onError: () => {
      // 에러가 발생하더라도 클라이언트 측 데이터는 정리
      tokenService.removeAccessToken();
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
    },
  });

export const useSNSLogin = () =>
  useMutation({
    mutationFn: ({ provider, token }: { provider: string; token: string }) =>
      auth.loginSNS(provider, token),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      tokenService.setAccessToken(access_token);
      useAuthStore.getState().setAuth(true, user);
    },
  });

export const useRefreshToken = () =>
  useMutation({
    mutationFn: () => auth.refreshToken(),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      tokenService.setAccessToken(access_token);
      useAuthStore.getState().setAuth(true, user);
    },
  });

export const useRegister = () =>
  useMutation({
    mutationFn: (data: RegisterData) => auth.register(data),
  });

export const useFindEmail = () =>
  useMutation({
    mutationFn: ({
      phoneNumber,
      birthdate,
    }: {
      phoneNumber: string;
      birthdate: string;
    }) => auth.findEmail(phoneNumber, birthdate),
  });

export const useRequestPhoneVerification = () =>
  useMutation({
    mutationFn: (data: PhoneVerificationData) =>
      auth.requestPhoneVerification(data.phone_number),
  });

export const useVerifyPhone = () =>
  useMutation({
    mutationFn: ({
      phoneNumber,
      verificationCode,
    }: {
      phoneNumber: string;
      verificationCode: string;
    }) => auth.verifyPhone(phoneNumber, verificationCode),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (data: PasswordResetData) =>
      auth.resetPassword(
        data.email,
        data.new_password,
        data.new_password_confirmation,
      ),
  });

export const useProcessCallback = (): UseMutationResult<
  ProcessCallbackResponse,
  AxiosError,
  { provider: string; code: string }
> =>
  useMutation({
    mutationFn: async ({ provider, code }) => {
      const response = await auth.processCallback(provider, code);

      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'success') {
        const refreshResponse = await auth.refreshToken();
        // refresh_token은 쿠키에 이미 설정되어 있음
        return {
          type: 'success',
          access_token: refreshResponse.data.access_token,
          user: refreshResponse.data.user,
        };
      }

      if (loginStatus === 'continue') {
        const emailResponse = await auth.getProviderEmail();
        return {
          type: 'continue',
          email: emailResponse.data.email,
        };
      }

      throw new Error('Invalid OAuth login status');
    },
  });

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const snsLoginMutation = useSNSLogin();
  const registerMutation = useRegister();
  const findEmailMutation = useFindEmail();
  const requestPhoneVerificationMutation = useRequestPhoneVerification();
  const verifyPhoneMutation = useVerifyPhone();
  const resetPasswordMutation = useResetPassword();
  const refreshTokenMutation = useRefreshToken();
  const processCallbackMutation = useProcessCallback();

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync(credentials);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      await registerMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  };

  const snsLogin = async (provider: string, token: string) => {
    setIsLoading(true);
    try {
      await snsLoginMutation.mutateAsync({ provider, token });
    } finally {
      setIsLoading(false);
    }
  };

  const findEmail = (phoneNumber: string, birthdate: string) =>
    findEmailMutation.mutate({ phoneNumber, birthdate });

  const requestPhoneVerification = (phoneNumber: string) =>
    requestPhoneVerificationMutation.mutate({ phone_number: phoneNumber });

  const verifyPhone = (phoneNumber: string, verificationCode: string) =>
    verifyPhoneMutation.mutate({ phoneNumber, verificationCode });

  const resetPassword = (
    email: string,
    newPassword: string,
    newPasswordConfirmation: string,
  ) =>
    resetPasswordMutation.mutate({
      email,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    });

  const refreshToken = () => refreshTokenMutation.mutate();

  const processOAuthCallback = (provider: string, code: string) =>
    processCallbackMutation.mutate({ provider, code });

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    register,
    logout,
    snsLogin,
    findEmail,
    requestPhoneVerification,
    verifyPhone,
    resetPassword,
    refreshToken,
    processOAuthCallback,
  };
};
