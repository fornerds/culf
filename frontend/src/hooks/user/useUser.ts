import { useQuery, useMutation } from '@tanstack/react-query';
import { user as userApi, token } from '../../api';
import { useAuthStore } from '../../state/client/authStore';
import { useEffect, useState } from 'react';
import { tokenService } from '@/utils/tokenService';

interface UserInfo {
  user_id: string;
  email: string;
  nickname: string;
  phone_number: string;
  total_tokens: number;
  created_at: string;
  updated_at: string;
  subscription?: {
    subscription_id: number;
    plan_id: number;
    plan_name: string;
    price: string;
    next_billing_date: string;
    status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  };
  notifications: any[];
  notification_settings: any[];
  notice_reads: any[];
}

interface UpdateUserData {
  nickname?: string;
  phone_number?: string;
}

interface VerifyPasswordData {
  current_password: string;
}

interface ChangePasswordData {
  new_password: string;
  new_password_confirm: string;
}

interface TokenInfo {
  total_tokens: number;
  used_tokens: number;
  last_charged_at: string;
}

export const useUser = () => {
  const { setAuth, registrationInProgress } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  const userInfoQuery = useQuery<UserInfo, Error>({
    queryKey: ['userInfo'],
    queryFn: async () => {
      // SNS 회원가입 진행 중이거나 terms 페이지에서는 API 호출 스킵
      const loginStatus = document.cookie
        .split('; ')
        .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'continue' || registrationInProgress) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Skipping user info fetch - Registration in progress');
        }
        return null;
      }

      try {
        const response = await userApi.getMyInfo();
        
        // 기존 토큰이 있다면 유지
        const currentToken = tokenService.getAccessToken();
        
        setAuth(true, {
          id: response.data.user_id,
          email: response.data.email,
          nickname: response.data.nickname
        }, currentToken);

        return response.data;
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        if (window.location.pathname !== '/terms') {
          setAuth(false, null);
        }
        throw error;
      }
    },
    enabled: !registrationInProgress && 
             isInitialized && 
             window.location.pathname !== '/terms' &&
             !document.cookie.includes('OAUTH_LOGIN_STATUS=continue'),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: false
  });

  const tokenInfoQuery = useQuery<TokenInfo, Error>({
    queryKey: ['tokenInfo'],
    queryFn: async () => {
      const loginStatus = document.cookie
        .split('; ')
        .find(row => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'continue' || registrationInProgress) {
        return null;
      }

      try {
        const response = await token.getMyTokenInfo();
        return response.data;
      } catch (error) {
        console.error('Failed to fetch token info:', error);
        return null;
      }
    },
    enabled: !registrationInProgress && 
             isInitialized && 
             userInfoQuery.isSuccess &&
             window.location.pathname !== '/terms' &&
             !document.cookie.includes('OAUTH_LOGIN_STATUS=continue'),
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  const updateUserInfoMutation = useMutation<UserInfo, Error, UpdateUserData>({
    mutationFn: async (userData) => {
      const response = await userApi.updateMyInfo(userData);
      return response.data;
    },
    onSuccess: () => {
      userInfoQuery.refetch();
    }
  });

  const deleteAccountMutation = useMutation<void, Error, { reason?: string; feedback?: string }>({
    mutationFn: async ({ reason, feedback }) => {
      await userApi.deleteAccount(reason, feedback);
      setAuth(false, null);
    },
  });

  const verifyPasswordMutation = useMutation<string, Error, VerifyPasswordData>({
    mutationFn: async ({ current_password }) => {
      const response = await userApi.verifyPassword(current_password);
      return response.data.message;
    },
  });

  const changePasswordMutation = useMutation<string, Error, ChangePasswordData>({
    mutationFn: async ({ new_password, new_password_confirm }) => {
      const response = await userApi.changePassword(
        new_password,
        new_password_confirm
      );
      return response.data.message;
    },
  });

  const updateUserInfo = async (userData: UpdateUserData) => {
    try {
      const response = await updateUserInfoMutation.mutateAsync(userData);
      return response;
    } catch (error) {
      console.error('Failed to update user info:', error);
      throw error;
    }
  };

  const deleteAccount = async (reason?: string, feedback?: string) => {
    try {
      await deleteAccountMutation.mutateAsync({ reason, feedback });
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error;
    }
  };

  const verifyPassword = async (currentPassword: string) => {
    try {
      return await verifyPasswordMutation.mutateAsync({
        current_password: currentPassword
      });
    } catch (error) {
      console.error('Failed to verify password:', error);
      throw error;
    }
  };

  const changePassword = async ({ new_password, new_password_confirm }: ChangePasswordData) => {
    try {
      return await changePasswordMutation.mutateAsync({
        new_password,
        new_password_confirm
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    setIsInitialized(true);
    return () => {
      setIsInitialized(false);
    };
  }, []);

  // 개발 모드에서 상태 변화 로깅
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('👤 User State Updated');
      console.log('Query Status:', userInfoQuery.status);
      console.log('Is Initialized:', isInitialized);
      console.log('Registration in Progress:', registrationInProgress);
      console.log('User Data:', userInfoQuery.data);
      console.log('Access Token:', tokenService.getAccessToken());
      console.groupEnd();
    }
  }, [userInfoQuery.status, isInitialized, registrationInProgress]);

  return {
    isLoading: userInfoQuery.isLoading || 
               tokenInfoQuery.isLoading || 
               updateUserInfoMutation.isLoading || 
               deleteAccountMutation.isLoading || 
               verifyPasswordMutation.isLoading || 
               changePasswordMutation.isLoading,
    isError: userInfoQuery.isError,
    error: userInfoQuery.error,
    isInitialized,
    getUserInfo: userInfoQuery,
    getTokenInfo: tokenInfoQuery,
    updateUserInfo,
    deleteAccount,
    verifyPassword,
    changePassword,
    refetchUser: userInfoQuery.refetch,
    refetchTokens: tokenInfoQuery.refetch
  };
};