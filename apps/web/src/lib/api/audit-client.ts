import { browserJson } from './browser-json';
import type { AuditEvent, AuditEventPage, AuditOverview, ListAuditQuery } from './audit-types';

export function listAuditEvents(
  query: ListAuditQuery = {},
  signal?: AbortSignal,
): Promise<AuditEventPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  /* One BFF endpoint fans out to the API's named streams via ?stream=. */
  return browserJson<AuditEventPage>(search ? `/api/audit/events?${search}` : '/api/audit/events', {
    cache: 'no-store',
    signal,
  });
}

export function getAuditEvent(eventId: string, signal?: AbortSignal): Promise<AuditEvent> {
  return browserJson<AuditEvent>(`/api/audit/events/${encodeURIComponent(eventId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function getAuditOverview(signal?: AbortSignal): Promise<AuditOverview> {
  return browserJson<AuditOverview>('/api/audit/overview', { cache: 'no-store', signal });
}
