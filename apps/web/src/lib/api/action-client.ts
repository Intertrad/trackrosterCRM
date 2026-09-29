import { browserJson } from './browser-json';
import type {
  ActionEventPage,
  ActionPage,
  ActionRecord,
  CompleteActionInput,
  CreateActionInput,
  ListActionsQuery,
} from './action-types';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

export function createAction(
  input: CreateActionInput,
  idempotencyKey: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>('/api/actions', {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function startAction(
  actionId: string,
  idempotencyKey: string,
  overrideId?: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}/start`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'idempotency-key': idempotencyKey },
    body: JSON.stringify(overrideId ? { overrideId } : {}),
  });
}

/**
 * Completes an action in a single server transaction.
 *
 * Replaces the previous sequence of three independent writes, where a failure
 * part-way through could leave an activity recorded with no follow-up and the
 * reservation still held.
 */
export function completeAction(
  actionId: string,
  input: CompleteActionInput,
  idempotencyKey: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}/complete`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function listActions(
  query: ListActionsQuery = {},
  signal?: AbortSignal,
): Promise<ActionPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<ActionPage>(search ? `/api/actions?${search}` : '/api/actions', {
    cache: 'no-store',
    signal,
  });
}

export function getAction(actionId: string, signal?: AbortSignal): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function listActionEvents(actionId: string, signal?: AbortSignal): Promise<ActionEventPage> {
  return browserJson<ActionEventPage>(`/api/actions/${encodeURIComponent(actionId)}/events`, {
    cache: 'no-store',
    signal,
  });
}

export function updateAction(
  actionId: string,
  input: { subject?: string; notes?: string | null },
  idempotencyKey: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

/** Only valid while the action is still planned or started. */
export function cancelAction(
  actionId: string,
  reason: string,
  idempotencyKey: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ reason }),
  });
}

/**
 * Appends a correction to a completed action.
 *
 * This does not edit the original record — the API keeps both, so the history
 * shows what was first logged and what it was corrected to.
 */
export function correctAction(
  actionId: string,
  input: { reason: string; notes: string; outcomeCode?: string },
  idempotencyKey: string,
): Promise<ActionRecord> {
  return browserJson<ActionRecord>(`/api/actions/${encodeURIComponent(actionId)}/corrections`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });
}
