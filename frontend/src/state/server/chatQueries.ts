// state/server/chatQueries.ts
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  UseQueryResult,
  UseMutationResult,
  UseInfiniteQueryResult,
  useQueryClient,
} from '@tanstack/react-query';
import { chat } from '@/api';
import { AxiosError, AxiosResponse } from 'axios';
import { useAuthStore } from '../client/authStore';
import { useChatRoomStore } from '../client/chatRoomStore';

// Types
export interface Message {
  question: string;
  imageFile?: File;
  roomId?: string;
}

export interface Conversation {
  conversation_id: string;
  user_id: string;
  question: string;
  question_image?: string;
  answer: string;
  question_time: string;
  answer_time: string;
  tokens_used: number;
}

export interface ConversationSummary {
  conversation_id: string;
  question_summary: string;
  answer_summary: string;
  question_time: string;
}

export interface ConversationsResponse {
  conversations: (Conversation | ConversationSummary)[];
  total_count: number;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  tokens_used: number;
}

export interface ChatRoom {
  room_id: string;
  curator_id: number;
  curator: {
    name: string;
    persona: string;
    main_image: string;
    profile_image: string;
    introduction: string;
    category: string;
    curator_id: number;
    tags: Array<{ name: string; tag_id: number }>;
  };
  title: string;
  created_at: string;
  updated_at: string;
  conversation_count: number;
  last_conversation?: Conversation;
}

export interface ConversationsQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  summary?: boolean;
  userId?: string;
  searchQuery?: string;
}

// Message Mutations
export const useSendMessage = (
  onMessageStream?: (message: string) => void
): UseMutationResult<ChatResponse, AxiosError, Message> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question, imageFile, roomId }) => {
      // undefined일 때만 빈 문자열로 변경, 이미 빈 문자열인 경우는 그대로 유지
      const message = question === undefined ? '' : question;
      
      const response = await chat.sendMessage(
        message,
        imageFile,
        roomId,
        onMessageStream
      );
      return response;
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      await queryClient.refetchQueries({ queryKey: ['chatRooms'] });
      
      if (variables.roomId) {
        await queryClient.invalidateQueries({ 
          queryKey: ['chatRoom', variables.roomId] 
        });
        await queryClient.refetchQueries({ 
          queryKey: ['chatRoom', variables.roomId] 
        });
      }
    },
  });
};

// Conversation Queries
export const useGetConversations = (
  params: ConversationsQueryParams = {}
): UseInfiniteQueryResult<ConversationsResponse, AxiosError> => {
  const { isAuthenticated } = useAuthStore();

  return useInfiniteQuery({
    queryKey: ['conversations', params],
    queryFn: ({ pageParam = 1 }) =>
      chat.getConversations(
        pageParam,
        params.limit,
        params.sort,
        params.summary,
        params.userId,
        params.searchQuery
      ).then((response) => response.data),
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return lastPage.conversations.length < (params.limit || 10)
        ? undefined
        : nextPage;
    },
    initialPageParam: 1,
    enabled: isAuthenticated,
    staleTime: 1000, // Consider data stale after 1 second
  });
};

export const useGetConversationById = (
  conversationId: string
): UseQueryResult<Conversation, AxiosError> => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () =>
      chat.getConversationById(conversationId).then((response) => response.data),
    staleTime: 1000,
  });
};

export const useDeleteConversation = (): UseMutationResult<void, AxiosError, string> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      chat.deleteConversation(conversationId),
    onSuccess: () => {
      // Invalidate chatRooms and conversations queries
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// Chat Room Queries
export const useGetChatRooms = (): UseQueryResult<ChatRoom[], AxiosError> => {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['chatRooms'],
    queryFn: () => chat.getChatRooms().then((response) => response.data),
    enabled: isAuthenticated,
    staleTime: 1000,
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useGetChatRoomById = (
  roomId: string
): UseQueryResult<ChatRoom, AxiosError> => {
  const queryClient = useQueryClient();
  const setCurrentRoom = useChatRoomStore((state) => state.setCurrentRoom);

  return useQuery({
    queryKey: ['chatRoom', roomId],
    queryFn: async () => {
      const response = await chat.getChatRoomById(roomId);
      const roomData = response.data;
      
      // Update chatRoomStore with the fetched data
      setCurrentRoom({
        roomId: roomData.room_id,
        curatorId: roomData.curator.curator_id,
        curatorInfo: {
          name: roomData.curator.name,
          profileImage: roomData.curator.profile_image,
          persona: roomData.curator.persona
        }
      });
      
      return roomData;
    },
    enabled: !!roomId,
    staleTime: 1000,
    initialData: () => {
      // Try to get initial data from chatRooms cache
      const chatRooms = queryClient.getQueryData<ChatRoom[]>(['chatRooms']);
      return chatRooms?.find((room) => room.room_id === roomId);
    },
  });
};

export const useCreateChatRoom = (): UseMutationResult<
  ChatRoom,
  AxiosError,
  { curatorId: number; title?: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ curatorId, title }) =>
      chat.createChatRoom(curatorId, title).then((response) => response.data),
    onSuccess: (newRoom) => {
      // Update the chatRooms cache with the new room
      queryClient.setQueryData<ChatRoom[]>(['chatRooms'], (old) => {
        return old ? [newRoom, ...old] : [newRoom];
      });
      
      // Also invalidate the query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
    },
  });
};

// Image Upload Mutation
export const useUploadImage = (): UseMutationResult<
  string,
  AxiosError,
  File
> => {
  return useMutation({
    mutationFn: (file: File) =>
      chat.uploadImage(file).then((response) => response.data),
  });
};

// Utility Types
export type ChatQueryHooks = {
  useSendMessage: typeof useSendMessage;
  useGetConversations: typeof useGetConversations;
  useGetConversationById: typeof useGetConversationById;
  useDeleteConversation: typeof useDeleteConversation;
  useGetChatRooms: typeof useGetChatRooms;
  useGetChatRoomById: typeof useGetChatRoomById;
  useCreateChatRoom: typeof useCreateChatRoom;
  useUploadImage: typeof useUploadImage;
};

export const chatQueryHooks: ChatQueryHooks = {
  useSendMessage,
  useGetConversations,
  useGetConversationById,
  useDeleteConversation,
  useGetChatRooms,
  useGetChatRoomById,
  useCreateChatRoom,
  useUploadImage,
};

export default chatQueryHooks;