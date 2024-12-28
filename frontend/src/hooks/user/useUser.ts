// hooks/useUser.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { user as userApi, token } from '../../api';
import { useAuthStore } from '../../state/client/authStore';
import { useEffect } from 'react';

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

interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

interface TokenInfo {
  total_tokens: number;
  used_tokens: number;
  last_charged_at: string;
}

export const useUser = () => {
  const { setAuth } = useAuthStore();

  const getUserInfoQuery = useQuery<UserInfo, Error>({
    queryKey: ['userInfo'],
    queryFn: async () => {
      const response = await userApi.getMyInfo();
      
      // setAuth를 queryFn 내에서 직접 호출하지 않음
      return response.data;
    },
    onSuccess: (data) => {
      // 성공 시 setAuth 호출
      setAuth(true, {
        id: data.user_id,
        email: data.email,
        nickname: data.nickname
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.group('🔍 User Info Fetch Success');
        console.log('User Data:', data);
        console.groupEnd();
      }
    },
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
    retry: false
  });

  const updateUserInfoMutation = useMutation<UserInfo, Error, UpdateUserData>({
    mutationFn: async (userData) => {
      const response = await userApi.updateMyInfo(userData);
      return response.data;
    },
    onSuccess: () => {
      getUserInfoQuery.refetch(); // 사용자 정보 업데이트 후 리페치
    }
  });

  const deleteAccountMutation = useMutation<void, Error, { reason?: string; feedback?: string }>({
    mutationFn: async ({ reason, feedback }) => {
      await userApi.deleteAccount(reason, feedback);
      setAuth(false, null); // 계정 삭제 후 인증 상태 리셋
    },
  });

  const verifyPasswordMutation = useMutation<boolean, Error, string>({
    mutationFn: async (currentPassword) => {
      const response = await userApi.verifyPassword(currentPassword);
      return response.data;
    },
  });

  const changePasswordMutation = useMutation<void, Error, ChangePasswordData>({
    mutationFn: async ({ current_password, new_password }) => {
      await userApi.changePassword(current_password, new_password);
    },
  });

  const getTokenInfoQuery = useQuery<TokenInfo, Error>({
    queryKey: ['tokenInfo'],
    queryFn: async () => {
      const response = await token.getMyTokenInfo();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });

  const updateUserInfo = async (userData: UpdateUserData) => {
    try {
      const response = await updateUserInfoMutation.mutateAsync(userData);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (reason?: string, feedback?: string) => {
    try {
      await deleteAccountMutation.mutateAsync({ reason, feedback });
    } catch (error) {
      throw error;
    }
  };

  const verifyPassword = async (currentPassword: string) => {
    try {
      const response = await verifyPasswordMutation.mutateAsync(currentPassword);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (current_password: string, new_password: string) => {
    try {
      await changePasswordMutation.mutateAsync({
        current_password,
        new_password,
      });
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && getUserInfoQuery.data) {
      console.group('👤 User State Updated');
      console.log('Status:', getUserInfoQuery.status);
      console.log('Data:', getUserInfoQuery.data);
      console.log('Is Loading:', getUserInfoQuery.isLoading);
      console.groupEnd();
    }
  }, [getUserInfoQuery.status]);

  return {
    isLoading: getUserInfoQuery.isLoading || updateUserInfoMutation.isLoading || 
               deleteAccountMutation.isLoading || verifyPasswordMutation.isLoading || 
               changePasswordMutation.isLoading,
    getUserInfo: getUserInfoQuery,
    updateUserInfo,
    deleteAccount,
    verifyPassword,
    changePassword,
    getTokenInfo: getTokenInfoQuery,
    refetchUser: getUserInfoQuery.refetch,
    refetchTokens: getTokenInfoQuery.refetch
  };
};