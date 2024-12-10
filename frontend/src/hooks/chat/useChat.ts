// hooks/chat/useChat.ts
import { useState } from 'react';
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  InfiniteData,
} from '@tanstack/react-query';
import { chat } from '../../api';
import { AxiosResponse } from 'axios';

interface Message {
  question: string;
  question_image?: string;
}

interface Conversation {
  conversation_id: string;
  user_id: string;
  question: string;
  question_image?: string;
  answer: string;
  question_time: string;
  answer_time: string;
  tokens_used: number;
}

interface ConversationSummary {
  conversation_id: string;
  question_summary: string;
  answer_summary: string;
  question_time: string;
}

interface ConversationsResponse {
  conversations: (Conversation | ConversationSummary)[];
  total_count: number;
}

const getConversations = (
  page: number = 1,
  limit: number = 10,
  sort: string = 'question_time:desc',
  summary: boolean = false,
): Promise<AxiosResponse<ConversationsResponse>> => {
  return chat.getConversations(page, limit, sort, summary);
};

export const useChat = () => {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessageMutation = useMutation({
    mutationFn: (message: Message) =>
      chat.sendMessage(message.question, message.question_image),
  });

  const getConversationsQuery = useInfiniteQuery<
    ConversationsResponse,
    Error,
    InfiniteData<ConversationsResponse>,
    string[],
    number
  >({
    queryKey: ['conversations'],
    queryFn: async ({ pageParam }) => {
      const response = await getConversations(pageParam);
      return response.data;
    },
    initialPageParam: 1, // 여기에 초기 페이지 파라미터를 추가합니다
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return lastPage.conversations.length === 0 ? undefined : nextPage;
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) =>
      chat.deleteConversation(conversationId),
  });

  const sendMessage = async (message: Message) => {
    setIsLoading(true);
    try {
      const response = await sendMessageMutation.mutateAsync(message);
      return response.data;
    } finally {
      setIsLoading(false);
    }
  };

  const getConversationById = (conversationId: string) => {
    return useQuery<Conversation, Error>({
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

  return {
    isLoading,
    sendMessage,
    getConversations: getConversationsQuery,
    getConversationById,
    deleteConversation,
  };
};
