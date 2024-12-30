import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { notification } from '@/api';
import { AxiosError } from 'axios';
import { Notification, NotificationListResponse } from '@/hooks/notice/useNotice';

interface NotificationsQueryParams {
  page?: number;
  limit?: number;
}

export const useGetNotifications = (
  params: NotificationsQueryParams = {},
): UseQueryResult<NotificationListResponse, AxiosError> =>
  useQuery({
    queryKey: ['notifications', params],
    queryFn: () =>
      notification
        .getMyNotifications(params.page, params.limit)
        .then((response) => response.data),
  });

export const useGetNotificationById = (
  notificationId: number,
): UseQueryResult<Notification, AxiosError> =>
  useQuery({
    queryKey: ['notification', notificationId],
    queryFn: () =>
      notification
        .getNotificationById(notificationId)
        .then((response) => response.data),
  });