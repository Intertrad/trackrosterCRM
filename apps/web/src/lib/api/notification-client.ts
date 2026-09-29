import { browserJson } from './browser-json';
import type { ListNotificationsQuery, NotificationPage } from './notification-types';

export function listNotifications(
  query: ListNotificationsQuery = {},
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<NotificationPage>(
    search ? `/api/notifications?${search}` : '/api/notifications',
    { cache: 'no-store', signal },
  );
}

export function getUnreadCount(signal?: AbortSignal): Promise<{ count: number }> {
  return browserJson<{ count: number }>('/api/notifications/unread-count', {
    cache: 'no-store',
    signal,
  });
}

export function markNotificationRead(notificationId: string): Promise<unknown> {
  return browserJson<unknown>(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
  });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return browserJson<{ updated: number }>('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
  });
}
