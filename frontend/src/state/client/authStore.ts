import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  nickname: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  selectedValues: string[];
  isMarketingAgreed: boolean;
  setAuth: (
    isAuthenticated: boolean,
    user: User | null,
    accessToken: string | null,
    refreshToken: string | null,
  ) => void;
  setSelectedValues: (
    update: string[] | ((prev: string[]) => string[]),
  ) => void;
  setIsMarketingAgreed: (isMarketingAgreed: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      selectedValues: [],
      isMarketingAgreed: false,
      setAuth: (isAuthenticated, user, accessToken, refreshToken) =>
        set({
          isAuthenticated,
          user,
          accessToken,
          refreshToken,
        }),
      setSelectedValues: (update) =>
        set((state) => ({
          selectedValues:
            typeof update === 'function'
              ? update(state.selectedValues)
              : update,
        })),
      setIsMarketingAgreed: (isMarketingAgreed: boolean) =>
        set({ isMarketingAgreed }),
      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
