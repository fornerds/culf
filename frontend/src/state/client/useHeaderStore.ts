import { create } from 'zustand';
import React from 'react';

interface HeaderState {
  useHeader: boolean;
  title: string | React.ReactNode;
  showBackButton: boolean;
  showMenuButton: boolean;
  remainingTokens: number;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  className?: string;
  onMenuClick: () => void;
  setUseHeader: (use: boolean) => void;
  setTitle: (title: string | React.ReactNode) => void;
  setShowBackButton: (show: boolean) => void;
  setShowMenuButton: (show: boolean) => void;
  setRemainingTokens: (tokens: number) => void;
  setLeftComponent: (component: React.ReactNode) => void;
  setRightComponent: (component: React.ReactNode) => void;
  setClassName: (className: string) => void;
  setOnMenuClick: (handler: () => void) => void;
  resetHeader: () => void;
}

const initialState = {
  useHeader: true,
  title: 'Your App Title',
  showBackButton: false,
  showMenuButton: false,
  remainingTokens: 0,
  leftComponent: undefined,
  rightComponent: undefined,
  className: undefined,
  onMenuClick: () => {},
};

export const useHeaderStore = create<HeaderState>()((set) => ({
  ...initialState,
  setUseHeader: (use) => set({ useHeader: use }),
  setTitle: (title) => set({ title }),
  setShowBackButton: (show) => set({ showBackButton: show }),
  setShowMenuButton: (show) => set({ showMenuButton: show }),
  setRemainingTokens: (tokens) => set({ remainingTokens: tokens }),
  setLeftComponent: (component) => set({ leftComponent: component }),
  setRightComponent: (component) => set({ rightComponent: component }),
  setClassName: (className) => set({ className }),
  setOnMenuClick: (handler) => set({ onMenuClick: handler }),
  resetHeader: () => set(initialState),
}));
