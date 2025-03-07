// hooks/user/useUser.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { user as userApi, token } from '@/api';
import { useAuthStore } from '@/state/client/authStore';
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
  const queryClient = useQueryClient();

  // Get user info
  const userInfoQuery = useQuery<UserInfo, Error>({
    queryKey: ['userInfo'],
    queryFn: async () => {
      // Check login status to determine if we should fetch user info
      const loginStatus = document.cookie
        .split('; ')
        .find((row) => row.startsWith('OAUTH_LOGIN_STATUS='))
        ?.split('=')[1];

      // Skip API call during SNS registration or on terms page
      if (loginStatus === 'continue' || window.location.pathname === '/terms') {
        return null;
      }

      try {
        const response = await userApi.getMyInfo();

        if (response.data) {
          const currentToken = tokenService.getAccessToken();
          // Update the auth store with latest user info
          setAuth(
            true,
            {
              id: response.data.user_id,
              email: response.data.email,
              nickname: response.data.nickname,
            },
            currentToken || undefined,
          );

          return response.data;
        }

        return null;
      } catch (error) {
        console.error('Failed to fetch user info:', error);

        // If we have a token, don't throw error so UI doesn't break
        if (tokenService.getAccessToken()) {
          return null;
        }

        // Clear auth state if we don't have a valid token
        setAuth(false, null);
        throw error;
      }
    },
    enabled:
      isInitialized &&
      !!tokenService.getAccessToken() &&
      !document.cookie.includes('OAUTH_LOGIN_STATUS=continue') &&
      window.location.pathname !== '/terms',
    staleTime: 1 * 60 * 1000, // 1 minute - more frequent refreshes
    retry: 1,
    retryDelay: 1000,
  });

  // Get token info
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
      !!userInfoQuery.data &&
      !!tokenService.getAccessToken(),
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: false,
  });

  // Update user info
  const updateUserInfoMutation = useMutation({
    mutationFn: async (userData: UpdateUserData) => {
      const response = await userApi.updateMyInfo(userData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInfo'] });
    },
  });

  // Delete account
  const deleteAccountMutation = useMutation({
    mutationFn: async ({
      reason,
      feedback,
    }: {
      reason?: string;
      feedback?: string;
    }) => {
      await userApi.deleteAccount(reason, feedback);
      setAuth(false, null);
    },
  });

  // Verify password
  const verifyPasswordMutation = useMutation({
    mutationFn: async ({ current_password }: VerifyPasswordData) => {
      const response = await userApi.verifyPassword(current_password);
      return response.data.message;
    },
  });

  // Change password
  const changePasswordMutation = useMutation({
    mutationFn: async ({
      new_password,
      new_password_confirm,
    }: ChangePasswordData) => {
      const response = await userApi.changePassword(
        new_password,
        new_password_confirm,
      );
      return response.data.message;
    },
  });

  // Utility functions
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
      // First verify the current password
      await verifyPasswordMutation.mutateAsync({
        current_password: currentPassword,
      });

      // If verification succeeds, change the password
      return await changePasswordMutation.mutateAsync({
        new_password: newPassword,
        new_password_confirm: newPassword,
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  };

  // Initialize the hook
  useEffect(() => {
    setIsInitialized(true);
    return () => {
      setIsInitialized(false);
    };
  }, []);

  // Conditionally refresh user info when token changes
  useEffect(() => {
    const token = tokenService.getAccessToken();
    if (token && isInitialized) {
      userInfoQuery.refetch();
    }
  }, [tokenService.getAccessToken(), isInitialized]);

  return {
    isLoading: userInfoQuery.isLoading || tokenInfoQuery.isLoading,
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
