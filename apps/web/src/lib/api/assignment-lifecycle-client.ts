import { browserJson } from './browser-json';
import type {
  Assignment,
  AssignmentPage,
  AssignmentPriority,
  ListAssignmentsQuery,
} from './assignment-lifecycle-types';

interface WriteOptions {
  etag: string | null;
  idempotencyKey: string;
}

function writeHeaders(options: WriteOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': options.idempotencyKey,
  };

  if (options.etag) {
    headers['if-match'] = options.etag;
  }

  return headers;
}

export function listAssignments(
  query: ListAssignmentsQuery = {},
  signal?: AbortSignal,
): Promise<AssignmentPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<AssignmentPage>(search ? `/api/assignments?${search}` : '/api/assignments', {
    cache: 'no-store',
    signal,
  });
}

export function getAssignment(assignmentId: string, signal?: AbortSignal): Promise<Assignment> {
  return browserJson<Assignment>(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    cache: 'no-store',
    signal,
  });
}

/** Pause, resume or re-prioritise without ending the assignment. */
export function updateAssignment(
  assignmentId: string,
  input: { status?: 'active' | 'paused'; priority?: AssignmentPriority },
  options: WriteOptions,
): Promise<Assignment> {
  return browserJson<Assignment>(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'PATCH',
    headers: writeHeaders(options),
    body: JSON.stringify(input),
  });
}

/**
 * Moves the prospect to another team or person.
 *
 * Upstream this ends the current assignment and opens a new one in the same
 * transaction, so the returned resource is the *new* assignment, not the one
 * that was passed in.
 */
export function reassignAssignment(
  assignmentId: string,
  input: { teamId: string; assignedUserId?: string | null; reason: string },
  options: WriteOptions,
): Promise<Assignment> {
  return browserJson<Assignment>(`/api/assignments/${encodeURIComponent(assignmentId)}/reassign`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: JSON.stringify(input),
  });
}

export function completeAssignment(
  assignmentId: string,
  reason: string,
  options: WriteOptions,
): Promise<Assignment> {
  return browserJson<Assignment>(`/api/assignments/${encodeURIComponent(assignmentId)}/complete`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: JSON.stringify({ reason }),
  });
}

export function revokeAssignment(
  assignmentId: string,
  reason: string,
  options: WriteOptions,
): Promise<Assignment> {
  return browserJson<Assignment>(`/api/assignments/${encodeURIComponent(assignmentId)}/revoke`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: JSON.stringify({ reason }),
  });
}
