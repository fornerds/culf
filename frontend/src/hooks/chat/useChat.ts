// hooks/chat/useChat.ts
import { useState } from 'react';
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  UseQueryResult,
  UseMutationResult,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { chat } from '@/api';
import { useAuthStore } from '@/state/client/authStore';
import { useTokenStore } from '@/state/client/useStoneStore';

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
  recommended_questions?: string[];
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

export interface UseChatParams {
  onMessageStream?: (message: string) => void;
}

export const useChat = ({ onMessageStream }: UseChatParams = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const { setShouldRefresh } = useTokenStore();

  // Send Message Mutation
  const sendMessageMutation = useMutation<
    ChatResponse,
    AxiosError,
    Message,
    unknown
  >({
    mutationFn: async ({ question, imageFile, roomId }) => {
      const response = await chat.sendMessage(
        question,
        imageFile,
        roomId,
        onMessageStream,
      );
      return response;
    },
    onSuccess: (data) => {
      // 메시지 전송 성공 후 토큰이 사용되었으므로 새로고침 필요 표시
      if (data && data.tokens_used) {
        setShouldRefresh(true);
      }
    },
    onError: (error) => {
      console.error('Message send error:', error);
    },
  });

  // Get Conversations Query
  const getConversationsQuery = useInfiniteQuery<
    ConversationsResponse,
    AxiosError,
    ConversationsResponse,
    string[],
    number
  >({
    queryKey: ['conversations'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await chat.getConversations(
        pageParam,
        10,
        'question_time:desc',
        false,
      );
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return lastPage.conversations.length === 0 ? undefined : nextPage;
    },
    enabled: isAuthenticated,
  });

  // Get Chat Rooms Query
  const getChatRoomsQuery = useQuery<ChatRoom[], AxiosError>({
    queryKey: ['chatRooms'],
    queryFn: async () => {
      const response = await chat.getChatRooms();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  // Create Chat Room Mutation
  const createChatRoomMutation = useMutation<
    ChatRoom,
    AxiosError,
    { curatorId: number; title?: string }
  >({
    mutationFn: async ({ curatorId, title }) => {
      const response = await chat.createChatRoom(curatorId, title);
      return response.data;
    },
  });

  // Delete Conversation Mutation
  const deleteConversationMutation = useMutation<void, AxiosError, string>({
    mutationFn: (conversationId: string) =>
      chat.deleteConversation(conversationId),
  });

  // Utility Functions
  const sendMessage = async (message: Message) => {
    setIsLoading(true);
    try {
      const response = await sendMessageMutation.mutateAsync(message);
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const getConversationById = (conversationId: string) => {
    return useQuery<Conversation, AxiosError>({
      queryKey: ['conversation', conversationId],
      queryFn: async () => {
        const response = await chat.getConversationById(conversationId);
        return response.data;
      },
    });
  };

  const deleteConversation = async (conversationId: string) => {
    setIsLoading(true);
    try {
      await deleteConversationMutation.mutateAsync(conversationId);
    } finally {
      setIsLoading(false);
    }
  };

  const createChatRoom = async (curatorId: number, title?: string) => {
    setIsLoading(true);
    try {
      const response = await createChatRoomMutation.mutateAsync({
        curatorId,
        title,
      });
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    isLoading,

    // Queries
    conversations: getConversationsQuery,
    chatRooms: getChatRoomsQuery,
    getConversationById,

    // Mutations
    sendMessage,
    createChatRoom,
    deleteConversation,

    // Raw Mutations (for more control)
    sendMessageMutation,
    createChatRoomMutation,
    deleteConversationMutation,
  };
};

export default useChat;
