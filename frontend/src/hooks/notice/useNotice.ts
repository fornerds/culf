import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { notification } from '@/api';
import { notice } from '@/api';
import { AxiosError } from 'axios';

export interface Notification {
  type: string;
  message: string;
  notification_id: number;
  user_id: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total_count: number;
  page: number;
  limit: number;
}

interface NotificationQueryParams {
  page?: number;
  limit?: number;
}

interface UseNoticesParams {
  page?: number;
  limit?: number;
}

interface Notice {
  notice_id: number;
  title: string;
  content: string;
  image_url?: string;
  start_date?: string;
  end_date?: string;
  is_public: boolean;
  is_important: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  is_read: boolean;
}

interface NoticeListResponse {
  notices: Notice[];
  total_count: number;
  page: number;
  limit: number;
}

interface NotificationResponse {
  notifications: Notification[];
  total_count: number;
  page: number;
  limit: number;
}

export const useNotices = ({ page = 1, limit = 10 }: UseNoticesParams = {}) => {
  return useQuery<NoticeListResponse>({
    queryKey: ['notices', { page, limit }],
    queryFn: async () => {
      const response = await notice.getNotices(page, limit);
      return response.data;
    }
  });
};

export const useNotifications = ({ page = 1, limit = 10 }: UseNotificationsParams = {}) => {
  return useQuery<NotificationResponse>({
    queryKey: ['notifications', { page, limit }],
    queryFn: async () => {
      const response = await notification.getMyNotifications(page, limit);
      return response.data;
    }
  });
};
