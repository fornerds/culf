import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

interface ChatRoom {
  roomId: string;
  curatorId: number;
  curatorInfo?: {
    name: string;
    profileImage: string;
    persona: string;
  };
  title?: string;
}

interface ChatRoomStore {
  currentRoom: ChatRoom | null;
  setCurrentRoom: (room: ChatRoom) => void;
  clearCurrentRoom: () => void;
}

export const useChatRoomStore = create<ChatRoomStore>()(
  devtools(
    subscribeWithSelector((set) => ({
      currentRoom: null,
      setCurrentRoom: (room) => set({ currentRoom: room }),
      clearCurrentRoom: () => set({ currentRoom: null }),
    }))
  )
);