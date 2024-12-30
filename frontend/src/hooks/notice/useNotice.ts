import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { notification } from '@/api';
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

export const useNotification = () => {
  const getNotificationsQuery = (
    params: NotificationQueryParams = {},
  ): UseQueryResult<NotificationListResponse, AxiosError> =>
    useQuery({
      queryKey: ['notifications', params],
      queryFn: async () => {
        const response = await notification.getMyNotifications(params.page, params.limit);
        return response.data;
      },
    });

  const getNotificationByIdQuery = (
    notificationId: number,
  ): UseQueryResult<Notification, AxiosError> =>
    useQuery({
      queryKey: ['notification', notificationId],
      queryFn: async () => {
        const response = await notification.getNotificationById(notificationId);
        return response.data;
      },
    });

  const markNotificationAsRead = (
    notificationId: number,
  ): UseQueryResult<void, AxiosError> =>
    useQuery({
      queryKey: ['notification', notificationId, 'read'],
      queryFn: async () => {
        const response = await notification.markNotificationAsRead(notificationId);
        return response.data;
      },
      enabled: false, // 자동으로 실행되지 않도록 설정
    });

  return {
    getNotifications: getNotificationsQuery,
    getNotificationById: getNotificationByIdQuery,
    markAsRead: markNotificationAsRead,
  };
};