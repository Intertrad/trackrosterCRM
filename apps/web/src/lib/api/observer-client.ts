import { browserJson } from './browser-json';
import type { AuditEvent, AuditEventPage, AuditStream } from './audit-types';
import type { ActionPage, ListActionsQuery } from './action-types';
import { listActions } from './action-client';
import { listProspects } from './prospect-client';
import type { ProspectPage, ProspectQuery } from './prospect-types';

export interface EvidenceExport {
  id: string;
  requestedBy: string;
  scope: Record<string, unknown>;
  status: string;
  objectKey: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export function listObserverAudit(
  stream: AuditStream = 'events',
  limit = 50,
  signal?: AbortSignal,
): Promise<AuditEventPage> {
  return browserJson<AuditEventPage>(`/api/audit/events?stream=${stream}&limit=${limit}`, {
    cache: 'no-store',
    signal,
  });
}

export function getObserverAuditEvent(id: string, signal?: AbortSignal): Promise<AuditEvent> {
  return browserJson<AuditEvent>(`/api/audit/events/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    signal,
  });
}

export function createObserverEvidenceExport(
  scope: Record<string, unknown>,
): Promise<EvidenceExport> {
  return browserJson<EvidenceExport>('/api/audit/evidence-exports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scope),
  });
}

export function listObserverActions(
  query: ListActionsQuery = {},
  signal?: AbortSignal,
): Promise<ActionPage> {
  return listActions({ limit: 100, periodDays: 30, ...query }, signal);
}

export function listObserverProspects(
  query: ProspectQuery = {},
  signal?: AbortSignal,
): Promise<ProspectPage> {
  return listProspects(
    { limit: 50, status: 'active', sort: 'name', direction: 'asc', ...query },
    signal,
  );
}
