import { browserJson } from './browser-json';
import type {
  DevicePlatform,
  NotificationPreferences,
  PushDevice,
} from './notification-preference-types';

function writeHeaders(): Record<string, string> {
  return { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() };
}

export function getNotificationPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
  return browserJson<NotificationPreferences>('/api/notification-preferences', {
    cache: 'no-store',
    signal,
  });
}

/* PUT replaces the whole document; the caller sends the full set. */
export function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  return browserJson<NotificationPreferences>('/api/notification-preferences', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preferences),
  });
}

export function registerDevice(token: string, platform: DevicePlatform): Promise<PushDevice> {
  return browserJson<PushDevice>('/api/devices', {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify({ token, platform }),
  });
}

export function revokeDevice(deviceId: string): Promise<void> {
  return browserJson<void>(`/api/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  });
}
