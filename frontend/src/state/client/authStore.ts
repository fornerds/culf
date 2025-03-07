// state/client/authStore.ts
import { create } from 'zustand';
import { QueryClient } from '@tanstack/react-query';
import { tokenService } from '@/utils/tokenService';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  nickname: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  selectedValues: string[];
  isMarketingAgreed: boolean;
  registrationInProgress: boolean;
  snsProvider: string | null;
  snsProviderId: string | null;

  // Methods
  setQueryClient: (queryClient: QueryClient) => void;
  setSelectedValues: (
    update: string[] | ((prev: string[]) => string[]),
  ) => void;
  setIsMarketingAgreed: (isMarketingAgreed: boolean) => void;
  setAuth: (
    isAuthenticated: boolean,
    user: User | null,
    accessToken?: string,
  ) => void;
  startRegistration: () => void;
  completeRegistration: () => void;
  logout: () => void;
  setSnsAuth: (provider: string, providerId: string) => void;
  resetSnsAuth: () => void;
  hasRefreshToken: () => boolean;

  // QueryClient for cache invalidation
  queryClient: QueryClient | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      queryClient: null,
      selectedValues: [],
      isMarketingAgreed: false,
      registrationInProgress: false,
      snsProvider: null,
      snsProviderId: null,

      setQueryClient: (queryClient: QueryClient) => {
        set({ queryClient });
      },

      setSelectedValues: (update) =>
        set((state) => ({
          selectedValues:
            typeof update === 'function'
              ? update(state.selectedValues)
              : update,
        })),

      setIsMarketingAgreed: (isMarketingAgreed: boolean) =>
        set({ isMarketingAgreed }),

      startRegistration: () => {
        set({ registrationInProgress: true });
      },

      completeRegistration: () => {
        set({ registrationInProgress: false });
      },

      setAuth: (isAuthenticated, user, accessToken?: string) => {
        // Clear relevant query cache if QueryClient exists
        if (get().queryClient) {
          get().queryClient.invalidateQueries({ queryKey: ['userInfo'] });
          get().queryClient.invalidateQueries({ queryKey: ['tokenInfo'] });
        }

        // Handle token management
        if (accessToken) {
          tokenService.setAccessToken(accessToken);
          set({ accessToken });
        } else if (!isAuthenticated) {
          tokenService.removeAccessToken();
          set({ accessToken: null });
        }

        // Update auth state
        set({
          isAuthenticated,
          user,
        });
      },

      hasRefreshToken: () => {
        return document.cookie
          .split('; ')
          .some((row) => row.startsWith('refresh_token='));
      },

      logout: () => {
        // Clear tokens first
        tokenService.removeAccessToken();

        // Invalidate cache
        if (get().queryClient) {
          get().queryClient.invalidateQueries({ queryKey: ['userInfo'] });
          get().queryClient.invalidateQueries({ queryKey: ['tokenInfo'] });
        }

        // Reset state
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          snsProvider: null,
          snsProviderId: null,
          registrationInProgress: false,
        });
      },

      setSnsAuth: (provider, providerId) => {
        set({
          snsProvider: provider,
          snsProviderId: providerId,
          registrationInProgress: true,
        });
      },

      resetSnsAuth: () => {
        set({
          snsProvider: null,
          snsProviderId: null,
          registrationInProgress: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    },
  ),
);
