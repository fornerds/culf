// state/server/authQueries.ts
import { useState } from 'react';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
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
  user?: User;
}

export const useLogin = (): UseMutationResult<
  { access_token: string; refresh_token: string; user: User },
  AxiosError,
  LoginCredentials
> => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      auth.login(credentials.email, credentials.password),
    onSuccess: (response) => {
      const { access_token, refresh_token, user } = response.data;
      
      // 기존 캐시 초기화
      queryClient.clear();
      useAuthStore.getState().setQueryClient(queryClient);
      
      // 토큰 저장
      tokenService.setAccessToken(access_token);
      
      // 인증 상태 업데이트
      useAuthStore.getState().setAuth(true, user, access_token, refresh_token);
      
      // if (process.env.NODE_ENV === 'development') {
      //   console.group('🔑 Login Success');
      //   console.log('User:', user);
      //   console.log('Cache cleared and new auth state set');
      //   console.groupEnd();
      // }
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      // 토큰 제거
      tokenService.removeAccessToken();
      
      // 모든 쿼리 캐시 초기화
      if (queryClient) {
        queryClient.clear();
      }
      
      // 인증 상태 초기화
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('👋 Logout: Auth state cleared and cache reset');
      }
    },
    onError: () => {
      tokenService.removeAccessToken();
      if (queryClient) {
        queryClient.clear();
      }
      useAuthStore.getState().setAuth(false, null);
      useAuthStore.getState().resetSnsAuth?.();
    },
  });
};

export const useSNSLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ provider, token }: { provider: string; token: string }) =>
      auth.loginSNS(provider, token),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      queryClient.clear();
      tokenService.setAccessToken(access_token);
      useAuthStore.getState().setAuth(true, user, queryClient);
    },
  });
};

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
    mutationFn: ({ phone_number, findPw }: { phone_number: string; findPw: boolean }) =>
      auth.requestPhoneVerification(phone_number, findPw),
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
> => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ provider, code }) => {
      const response = await auth.processCallback(provider, code);

      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'success') {
        const refreshResponse = await auth.refreshToken();
        queryClient.clear();
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
};

export const useRefreshToken = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => auth.refreshToken(),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      queryClient.clear();
      tokenService.setAccessToken(access_token);
      useAuthStore.getState().setAuth(true, user, queryClient);
    },
  });
};