import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  nickname: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  setAuth: (isAuthenticated: boolean, user: User | null) => void;
  logout: () => void;
  snsProvider: string | null;
  snsProviderId: string | null;
  setSnsAuth: (provider: string, providerId: string) => void;
  resetSnsAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  setAuth: (isAuthenticated, user) =>
    set({
      isAuthenticated,
      user,
    }),
  logout: () =>
    set({
      isAuthenticated: false,
      user: null,
    }),
  snsProvider: null,
  snsProviderId: null,
  setSnsAuth: (provider, providerId) =>
    set({ snsProvider: provider, snsProviderId: providerId }),
  resetSnsAuth: () => set({ snsProvider: null, snsProviderId: null }),
}));
