// hooks/user/useUser.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { user as userApi, token } from '../../api';
import { useAuthStore } from '../../state/client/authStore';
import { useTokenStore } from '../../state/client/useStoneStore';
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
  const { setTokens, shouldRefresh, setShouldRefresh } = useTokenStore();
  const [isInitialized, setIsInitialized] = useState(false);

  const userInfoQuery = useQuery<UserInfo, Error>({
    queryKey: ['userInfo'],
    queryFn: async () => {
      // Login Status 체크
      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      // Skip API call if:
      // 1. SNS registration is in progress
      // 2. We're on the terms page
      if (loginStatus === 'continue' || window.location.pathname === '/terms') {
        console.log(
          'Skipping user info fetch - SNS registration or terms page',
        );
        return null;
      }

      try {
        // 실제 API 호출
        const response = await userApi.getMyInfo();

        // API 응답 성공시 상태 업데이트
        if (response.data) {
          const currentToken = tokenService.getAccessToken();
          setAuth(
            true,
            {
              id: response.data.user_id,
              email: response.data.email,
              nickname: response.data.nickname,
            },
            currentToken,
          );

          // 토큰 스토어 업데이트
          setTokens(response.data.total_tokens || 0);

          return response.data;
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch user info:', error);
        const currentToken = tokenService.getAccessToken();

        // 토큰이 있는 경우는 일단 에러를 무시
        if (currentToken) {
          return null;
        }

        setAuth(false, null);
        throw error;
      }
    },
    // 쿼리 실행 조건
    enabled:
      isInitialized && // 초기화 완료
      !!tokenService.getAccessToken() && // 토큰 존재
      !document.cookie.includes('OAUTH_LOGIN_STATUS=continue') && // SNS 로그인 진행 중 아님
      window.location.pathname !== '/terms', // terms 페이지 아님
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
    retry: 1, // 한 번의 재시도 허용
    retryDelay: 1000, // 1초 후 재시도
  });

  const tokenInfoQuery = useQuery<TokenInfo, Error>({
    queryKey: ['tokenInfo'],
    queryFn: async () => {
      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      if (loginStatus === 'continue' || window.location.pathname === '/terms') {
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
    enabled:
      isInitialized &&
      !registrationInProgress &&
      userInfoQuery.isSuccess &&
      !!tokenService.getAccessToken() &&
      !document.cookie.includes('OAUTH_LOGIN_STATUS=continue'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // shouldRefresh 상태가 true일 때 사용자 정보 갱신
  useEffect(() => {
    if (shouldRefresh && tokenService.getAccessToken()) {
      userInfoQuery.refetch().then(() => {
        setShouldRefresh(false);
      });
    }
  }, [shouldRefresh, setShouldRefresh, userInfoQuery]);

  const updateUserInfoMutation = useMutation<UserInfo, Error, UpdateUserData>({
    mutationFn: async (userData) => {
      const response = await userApi.updateMyInfo(userData);
      return response.data;
    },
    onSuccess: () => {
      userInfoQuery.refetch();
    },
  });

  const deleteAccountMutation = useMutation<
    void,
    Error,
    { reason?: string; feedback?: string }
  >({
    mutationFn: async ({ reason, feedback }) => {
      await userApi.deleteAccount(reason, feedback);
      setAuth(false, null);
    },
  });

  const verifyPasswordMutation = useMutation<string, Error, VerifyPasswordData>(
    {
      mutationFn: async ({ current_password }) => {
        const response = await userApi.verifyPassword(current_password);
        return response.data.message;
      },
    },
  );

  const changePasswordMutation = useMutation<string, Error, ChangePasswordData>(
    {
      mutationFn: async ({ new_password, new_password_confirm }) => {
        const response = await userApi.changePassword(
          new_password,
          new_password_confirm,
        );
        return response.data.message;
      },
    },
  );

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
        current_password: currentPassword,
      });
    } catch (error) {
      console.error('Failed to verify password:', error);
      throw error;
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    try {
      // 먼저 현재 비밀번호 검증
      await verifyPasswordMutation.mutateAsync({
        current_password: currentPassword,
      });

      // 검증 성공 후 새 비밀번호로 변경
      return await changePasswordMutation.mutateAsync({
        new_password: newPassword,
        new_password_confirm: newPassword,
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  };

  useEffect(() => {
    setIsInitialized(true);
    return () => {
      setIsInitialized(false);
    };
  }, []);

  return {
    isLoading:
      userInfoQuery.isLoading ||
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
    refetchTokens: tokenInfoQuery.refetch,
  };
};
