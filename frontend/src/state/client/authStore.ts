// state/client/authStore.ts
import { create } from 'zustand';
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
  selectedValues: string[];
  isMarketingAgreed: boolean;
  queryClient: QueryClient | null;
  registrationInProgress: boolean;  // SNS 회원가입 진행 중 상태 추가
  
  setSelectedValues: (update: string[] | ((prev: string[]) => string[])) => void;
  setIsMarketingAgreed: (isMarketingAgreed: boolean) => void;
  setAuth: (
    isAuthenticated: boolean, 
    user: User | null, 
    access_token?: string
  ) => void;
  startRegistration: () => void;  // 회원가입 프로세스 시작
  completeRegistration: () => void;  // 회원가입 프로세스 완료
  logout: () => void;
  snsProvider: string | null;
  snsProviderId: string | null;
  setSnsAuth: (provider: string, providerId: string) => void;
  resetSnsAuth: () => void;
  setQueryClient: (queryClient: QueryClient) => void;
  hasRefreshToken: () => boolean;  // 리프레시 토큰 존재 여부 확인 함수 추가
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  queryClient: null,
  selectedValues: [],
  isMarketingAgreed: false,
  registrationInProgress: false,
  
  setQueryClient: (queryClient: QueryClient) => {
    set({ queryClient });
  },
  
  setSelectedValues: (update) =>
    set((state) => ({
      selectedValues:
        typeof update === 'function' ? update(state.selectedValues) : update,
    })),
    
  setIsMarketingAgreed: (isMarketingAgreed: boolean) =>
    set({ isMarketingAgreed }),
    
  startRegistration: () => {
    set({ registrationInProgress: true });
  },

  completeRegistration: () => {
    set({ registrationInProgress: false });
  },
    
  setAuth: (isAuthenticated, user, access_token?: string) => {
    if (get().queryClient) {
      try {
        get().queryClient.clear();
      } catch (error) {
        console.error('Failed to clear query cache:', error);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.group('🔐 Auth State Update');
      console.log('Authenticated:', isAuthenticated);
      console.log('User:', user);
      console.log('Access Token:', access_token ? 'Present' : 'None');
      console.log('Registration in progress:', get().registrationInProgress);
      console.groupEnd();
    }
    
    set({
      isAuthenticated,
      user
    });
  },
  
  hasRefreshToken: () => {
    return document.cookie
      .split('; ')
      .some(row => row.startsWith('refresh_token='));
  },
  
  logout: () => {
    if (get().queryClient) {
      try {
        get().queryClient.clear();
      } catch (error) {
        console.error('Failed to clear query cache during logout:', error);
      }
    }
    
    // 토큰 및 상태 초기화
    tokenService.removeAccessToken();
    
    set({
      isAuthenticated: false,
      user: null,
      snsProvider: null,
      snsProviderId: null,
      registrationInProgress: false
    });
  },
  
  snsProvider: null,
  snsProviderId: null,
  setSnsAuth: (provider, providerId) => {
    set({ 
      snsProvider: provider, 
      snsProviderId: providerId,
      registrationInProgress: true  // SNS 인증 시작 시 회원가입 프로세스 시작
    });
  },
  resetSnsAuth: () => {
    set({ 
      snsProvider: null, 
      snsProviderId: null,
      registrationInProgress: false
    });
  },
}));