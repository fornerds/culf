import { create } from 'zustand';

interface SideMenuState {
  isOpen: boolean;
  toggle: () => void;
}

export const useSideMenuStore = create<SideMenuState>((set, get) => ({
  isOpen: false,
  toggle: () => {
    const currentState = get().isOpen;
    const newState = !currentState;
    console.log(`SideMenu toggle: ${currentState} -> ${newState}`);
    set({ isOpen: newState });
  },
}));
