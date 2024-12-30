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
  findpw?: boolean;
}

interface PhoneVerificationResponse {
  success: boolean;
  message: string;
}

interface VerifyPhoneData {
  phone_number: string;
  verification_code: string;
}

interface PasswordResetData {
  email: string;
  phone_number: string;
  new_password: string;
  new_password_confirm: string;
}

interface ProcessCallbackResponse {
  type: 'success' | 'continue';
  access_token?: string;
  refresh_token?: string;
  email?: string;
  user?: User;
}

export const useLogin = (): UseMutationResult<
  { access_token: string; user: User },
  AxiosError,
  LoginCredentials
> => {
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await auth.login(credentials.email, credentials.password);
      return response.data;
    },
    onSuccess: (data) => {
      const { access_token, user } = data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
    },
    onError: () => {
      tokenService.removeAccessToken();
      setAuth(false, null);
    },
  });
};

export const useLogout = () => {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      logout();
    },
    onError: () => {
      logout();
    },
  });
};

export const useSNSLogin = () => {
  const { setAuth, setSnsAuth } = useAuthStore();

  return useMutation({
    mutationFn: async ({ provider, token }: { provider: string; token: string }) => {
      const response = await auth.loginSNS(provider, token);
      return response.data;
    },
    onSuccess: (data, variables) => {
      const { access_token, user } = data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
      setSnsAuth(variables.provider, user.id);
    },
    onError: () => {
      tokenService.removeAccessToken();
      setAuth(false, null);
    },
  });
};

export const useRefreshToken = () => {
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      const response = await auth.refreshToken();
      return response.data;
    },
    onSuccess: (data) => {
      const { access_token, user } = data;
      tokenService.setAccessToken(access_token);
      setAuth(true, user);
    },
    onError: () => {
      tokenService.removeAccessToken();
      setAuth(false, null);
    },
  });
};

export const useRegister = () => {
  const { isMarketingAgreed } = useAuthStore();

  return useMutation({
    mutationFn: async (data: RegisterData) => {
      const registerData = {
        ...data,
        marketing_agreed: isMarketingAgreed,
      };
      const response = await auth.register(registerData);
      return response.data;
    },
  });
};

export const useFindEmail = () =>
  useMutation({
    mutationFn: async ({
      phoneNumber,
      birthdate,
    }: {
      phoneNumber: string;
      birthdate: string;
    }) => {
      const response = await auth.findEmail(phoneNumber, birthdate);
      return response.data;
    },
  });

export const useRequestPhoneVerification = () =>
  useMutation({
    mutationFn: async ({ phone_number, findpw = false }: PhoneVerificationData) => {
      const response = await auth.requestPhoneVerification(phone_number, findpw);
      return response.data;
    },
  });

export const useVerifyPhone = () =>
  useMutation({
    mutationFn: async ({ phoneNumber, verificationCode }: VerifyPhoneData) => {
      const response = await auth.verifyPhone(phoneNumber, verificationCode);
      return response.data;
    },
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: async (data: PasswordResetData) => {
      const response = await auth.resetPassword(
        data.email,
        data.phone_number,
        data.new_password,
        data.new_password_confirm
      );
      return response.data;
    },
  });

export const useProcessCallback = (): UseMutationResult<
  ProcessCallbackResponse,
  AxiosError,
  { provider: string; code: string }
> => {
  const { startRegistration, completeRegistration, setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async ({ provider, code }) => {
      const response = await auth.processCallback(provider, code);
      
      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'success') {
        const refreshResponse = await auth.refreshToken();
        completeRegistration();
        
        const { access_token, user } = refreshResponse.data;
        tokenService.setAccessToken(access_token);
        setAuth(true, user);
        
        return {
          type: 'success',
          access_token,
          user,
        };
      }

      if (loginStatus === 'continue') {
        startRegistration();
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

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { 
    isAuthenticated, 
    user, 
    hasRefreshToken,
    registrationInProgress 
  } = useAuthStore();

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

  const findEmail = async (phoneNumber: string, birthdate: string) => {
    setIsLoading(true);
    try {
      return await findEmailMutation.mutateAsync({ phoneNumber, birthdate });
    } finally {
      setIsLoading(false);
    }
  };

  const requestPhoneVerification = async (phoneNumber: string, findpw = false) => {
    setIsLoading(true);
    try {
      return await requestPhoneVerificationMutation.mutateAsync({ 
        phone_number: phoneNumber, 
        findpw 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhone = async (phoneNumber: string, verificationCode: string) => {
    setIsLoading(true);
    try {
      return await verifyPhoneMutation.mutateAsync({ phoneNumber, verificationCode });
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (data: PasswordResetData) => {
    setIsLoading(true);
    try {
      return await resetPasswordMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    setIsLoading(true);
    try {
      return await refreshTokenMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  };

  const processOAuthCallback = async (provider: string, code: string) => {
    setIsLoading(true);
    try {
      return await processCallbackMutation.mutateAsync({ provider, code });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    hasRefreshToken,
    registrationInProgress,
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