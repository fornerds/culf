// state/client/authStore.ts
import { create } from 'zustand';
import { QueryClient } from '@tanstack/react-query';

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
  setSelectedValues: (update: string[] | ((prev: string[]) => string[])) => void;
  setIsMarketingAgreed: (isMarketingAgreed: boolean) => void;
  setAuth: (
    isAuthenticated: boolean, 
    user: User | null, 
    access_token?: string,
    refresh_token?: string
  ) => void;
  logout: () => void;
  snsProvider: string | null;
  snsProviderId: string | null;
  setSnsAuth: (provider: string, providerId: string) => void;
  resetSnsAuth: () => void;
  setQueryClient: (queryClient: QueryClient) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  queryClient: null,
  selectedValues: [],
  isMarketingAgreed: false,
  
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
    
  setAuth: (
    isAuthenticated, 
    user, 
    access_token?: string,
    refresh_token?: string
  ) => {
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
      console.groupEnd();
    }
    
    set({
      isAuthenticated,
      user
    });
  },
  
  logout: () => {
    if (get().queryClient) {
      try {
        get().queryClient.clear();
      } catch (error) {
        console.error('Failed to clear query cache during logout:', error);
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🚪 Logging out: Clearing auth state and cache');
    }
    
    set({
      isAuthenticated: false,
      user: null,
      snsProvider: null,
      snsProviderId: null
    });
  },
  
  snsProvider: null,
  snsProviderId: null,
  setSnsAuth: (provider, providerId) =>
    set({ snsProvider: provider, snsProviderId: providerId }),
  resetSnsAuth: () => set({ snsProvider: null, snsProviderId: null }),
}));