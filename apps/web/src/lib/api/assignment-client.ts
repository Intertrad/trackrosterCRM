import { browserJson } from './browser-json';
import type {
  AssignmentBatchInput,
  AssignmentBatchResult,
  UnassignedFilters,
  UnassignedProspectPage,
} from './assignment-types';

export function listUnassignedProspects(
  input: UnassignedFilters,
  signal?: AbortSignal,
): Promise<UnassignedProspectPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    /* An empty filter is no filter; sending it would be a 400 on the length rules. */
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  return browserJson<UnassignedProspectPage>(`/api/assignments/unassigned?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
}

export function previewAssignment(
  input: AssignmentBatchInput,
  signal?: AbortSignal,
): Promise<AssignmentBatchResult> {
  return send('preview', input, signal);
}

export function applyAssignment(
  input: AssignmentBatchInput,
  idempotencyKey: string,
): Promise<AssignmentBatchResult> {
  return send('bulk', input, undefined, idempotencyKey);
}

function send(
  mode: 'preview' | 'bulk',
  input: AssignmentBatchInput,
  signal?: AbortSignal,
  idempotencyKey?: string,
): Promise<AssignmentBatchResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  return browserJson<AssignmentBatchResult>(`/api/assignments/${mode}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    signal,
  });
}
