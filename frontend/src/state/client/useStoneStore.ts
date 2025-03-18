import { create } from 'zustand';

interface TokenState {
  tokens: number;
  setTokens: (tokens: number) => void;
  shouldRefresh: boolean;
  setShouldRefresh: (value: boolean) => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  tokens: 0,
  setTokens: (tokens: number) => set({ tokens, shouldRefresh: false }),
  shouldRefresh: true, // 초기값을 true로 설정하여 첫 로드 시 데이터 로드
  setShouldRefresh: (value: boolean) => set({ shouldRefresh: value }),
}));
