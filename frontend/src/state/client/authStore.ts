// state/client/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { QueryClient } from '@tanstack/react-query';
import { tokenService } from '@/utils/tokenService';

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

// sessionStorage를 사용하도록 설정된 저장소
const sessionStorageAdapter = {
  getItem: (name: string) => {
    const value = sessionStorage.getItem(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: (name: string, value: unknown) => {
    sessionStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    sessionStorage.removeItem(name);
  },
};

// 개선된 버전 - sessionStorage 사용
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
        // 중요: 인증 상태를 변경하기 전에 쿼리 캐시를 무효화
        const queryClient = get().queryClient;
        if (queryClient) {
          // null 체크 추가
          try {
            // 모든 사용자 관련 쿼리를 무효화
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            queryClient.invalidateQueries({ queryKey: ['tokenInfo'] });
          } catch (error) {
            console.error('Failed to invalidate queries:', error);
          }
        }

        // 인증 상태 업데이트 (토큰 + 사용자 정보)
        if (isAuthenticated && accessToken) {
          // 로그인 성공 시 토큰 저장 (sessionStorage)
          tokenService.setAccessToken(accessToken);

          // 상태 업데이트
          set({
            isAuthenticated: true,
            user,
            accessToken,
          });

          // 토큰이 sessionStorage에 제대로 저장되었는지 확인
          console.log(
            'Token saved to sessionStorage:',
            tokenService.getAccessToken(),
          );
        } else if (!isAuthenticated) {
          // 로그아웃 시 토큰 제거
          tokenService.removeAccessToken();

          // 상태 초기화
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
          });
        } else {
          // accessToken 없이 인증만 설정하는 경우 (기존 토큰 유지)
          set({
            isAuthenticated,
            user,
          });
        }
      },

      hasRefreshToken: () => {
        return document.cookie
          .split('; ')
          .some((row) => row.startsWith('refresh_token='));
      },

      logout: () => {
        // 토큰 제거를 먼저 수행
        tokenService.removeAccessToken();

        // 캐시 무효화
        const queryClient = get().queryClient;
        if (queryClient) {
          // null 체크 추가
          try {
            // 사용자 정보 관련 쿼리 무효화
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            queryClient.invalidateQueries({ queryKey: ['tokenInfo'] });
          } catch (error) {
            console.error('Failed to invalidate queries during logout:', error);
          }
        }

        // 상태 초기화
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          snsProvider: null,
          snsProviderId: null,
          registrationInProgress: false,
        });

        console.log('로그아웃 완료: 인증 상태 및 세션 정보 초기화');
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
      name: 'auth-session',
      // sessionStorage 사용하도록 지정
      storage: createJSONStorage(() => sessionStorageAdapter),
      // 저장할 상태 지정
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        snsProvider: state.snsProvider,
        snsProviderId: state.snsProviderId,
      }),
    },
  ),
);
