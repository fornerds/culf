// hooks/auth/useAuth.ts
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { auth } from '../../api/index';
import { useAuthStore } from '../../state/client/authStore';
import { tokenService } from '@/utils/tokenService';

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

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user, setAuth } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      auth.login(credentials.email, credentials.password),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => auth.register(data),
  });

  const logoutMutation = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => {
      tokenService.removeAccessToken();
      setAuth(false, null);
    },
  });

  const snsLoginMutation = useMutation({
    mutationFn: ({ provider, token }: { provider: string; token: string }) =>
      auth.loginSNS(provider, token),
    onSuccess: (response) => {
      const { access_token, user, isNewUser, need_additional_info } =
        response.data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
    },
  });

  const findEmailMutation = useMutation({
    mutationFn: ({
      phoneNumber,
      birthdate,
    }: {
      phoneNumber: string;
      birthdate: string;
    }) => auth.findEmail(phoneNumber, birthdate),
  });

  const requestPhoneVerificationMutation = useMutation({
    mutationFn: (data: PhoneVerificationData) =>
      auth.requestPhoneVerification(data.phone_number),
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: ({
      phoneNumber,
      verificationCode,
    }: {
      phoneNumber: string;
      verificationCode: string;
    }) => auth.verifyPhone(phoneNumber, verificationCode),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: PasswordResetData) =>
      auth.resetPassword(
        data.email,
        data.new_password,
        data.new_password_confirmation,
      ),
  });

  const refreshTokenMutation = useMutation({
    mutationFn: () => auth.refreshToken(),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
    },
  });

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
  };
};
