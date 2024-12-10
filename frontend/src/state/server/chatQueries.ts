// state/server/chatQueries.ts
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  UseQueryResult,
  UseMutationResult,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { chat } from '../../api';
import { AxiosError } from 'axios';

interface Message {
  question: string;
  imageFile?: File;
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

interface ChatResponse {
  conversation_id: string;
  answer: string;
  tokens_used: number;
}

interface ConversationsQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  summary?: boolean;
}

export const useSendMessage = (): UseMutationResult<
  ChatResponse,
  AxiosError,
  { question: string; imageFile?: File },
  unknown
> => {
  return useMutation({
    mutationFn: async ({ question, imageFile }) => {
      const formData = new FormData();
      formData.append('question', question);
      if (imageFile) {
        formData.append('question_image', imageFile);
      }

      const response = await chat.sendMessage(question, imageFile);
      return response;
    },
  });
};

export const useGetConversations = (
  params: ConversationsQueryParams = {},
): UseInfiniteQueryResult<ConversationsResponse, AxiosError> =>
  useInfiniteQuery({
    queryKey: ['conversations', params],
    queryFn: ({ pageParam = 1 }) =>
      chat
        .getConversations(pageParam, params.limit, params.sort, params.summary)
        .then((response) => response.data),
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return lastPage.conversations.length < (params.limit || 10)
        ? undefined
        : nextPage;
    },
    initialPageParam: 1,
  });

export const useGetConversationById = (
  conversationId: string,
): UseQueryResult<Conversation, AxiosError> =>
  useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () =>
      chat
        .getConversationById(conversationId)
        .then((response) => response.data),
  });

export const useDeleteConversation = (): UseMutationResult<
  void,
  AxiosError,
  string
> =>
  useMutation({
    mutationFn: (conversationId: string) =>
      chat.deleteConversation(conversationId).then((response) => response.data),
  });
