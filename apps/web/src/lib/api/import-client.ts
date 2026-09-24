import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import type {
  ImportIssuePage,
  ImportJob,
  ImportJobPage,
  ImportResolution,
  ImportRowPage,
} from './import-types';

interface WriteOptions {
  etag: string | null;
  idempotencyKey: string;
}

function writeHeaders(options: WriteOptions, contentType = 'application/json') {
  const headers: Record<string, string> = {
    'content-type': contentType,
    'idempotency-key': options.idempotencyKey,
  };

  if (options.etag) {
    headers['if-match'] = options.etag;
  }

  return headers;
}

export function listImports(
  query: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ImportJobPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<ImportJobPage>(search ? `/api/imports?${search}` : '/api/imports', {
    cache: 'no-store',
    signal,
  });
}

export function createImport(idempotencyKey: string): Promise<ImportJob> {
  return browserJson<ImportJob>('/api/imports', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: '{}',
  });
}

export function getImport(
  importId: string,
  signal?: AbortSignal,
): Promise<BrowserResource<ImportJob>> {
  return browserResource<ImportJob>(`/api/imports/${encodeURIComponent(importId)}`, {
    cache: 'no-store',
    signal,
  });
}

/*
 * The file is streamed as multipart/form-data under the field name "file",
 * which the API enforces. The browser sets its own multipart boundary, so no
 * content-type header is supplied here.
 */
export function uploadImportFile(
  importId: string,
  file: File,
  options: WriteOptions,
): Promise<ImportJob> {
  const body = new FormData();

  body.append('file', file, file.name);

  const headers: Record<string, string> = { 'idempotency-key': options.idempotencyKey };

  if (options.etag) {
    headers['if-match'] = options.etag;
  }

  return browserJson<ImportJob>(`/api/imports/${encodeURIComponent(importId)}/file`, {
    method: 'POST',
    headers,
    body,
  });
}

export function saveImportMapping(
  importId: string,
  mapping: Record<string, string>,
  options: WriteOptions,
): Promise<ImportJob> {
  return browserJson<ImportJob>(`/api/imports/${encodeURIComponent(importId)}/mapping`, {
    method: 'PUT',
    headers: writeHeaders(options),
    body: JSON.stringify({ mapping }),
  });
}

export function validateImport(importId: string, options: WriteOptions): Promise<ImportJob> {
  return browserJson<ImportJob>(`/api/imports/${encodeURIComponent(importId)}/validate`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: '{}',
  });
}

export function listImportRows(
  importId: string,
  query: { afterRow?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ImportRowPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  const path = `/api/imports/${encodeURIComponent(importId)}/rows`;

  return browserJson<ImportRowPage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

export function listImportIssues(
  importId: string,
  query: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ImportIssuePage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  const path = `/api/imports/${encodeURIComponent(importId)}/issues`;

  return browserJson<ImportIssuePage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

/**
 * Resolves one issue.
 *
 * A "correct" resolution rewinds the whole job to `uploaded` and discards
 * every parsed row, so the caller must re-validate before the job can be
 * committed. The returned job carries the new status; callers should trust it
 * rather than assuming the job stayed validated.
 */
export function resolveImportIssue(
  issueId: string,
  resolution: ImportResolution,
  options: WriteOptions & { values?: Record<string, string> },
): Promise<ImportJob> {
  const body: Record<string, unknown> = { resolution };

  if (resolution === 'correct') {
    body.values = options.values ?? {};
  }

  return browserJson<ImportJob>(`/api/import-issues/${encodeURIComponent(issueId)}`, {
    method: 'PATCH',
    headers: writeHeaders(options),
    body: JSON.stringify(body),
  });
}

export function commitImport(importId: string, options: WriteOptions): Promise<ImportJob> {
  return browserJson<ImportJob>(`/api/imports/${encodeURIComponent(importId)}/commit`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: '{}',
  });
}

export function cancelImport(importId: string, options: WriteOptions): Promise<ImportJob> {
  return browserJson<ImportJob>(`/api/imports/${encodeURIComponent(importId)}/cancel`, {
    method: 'POST',
    headers: writeHeaders(options),
    body: '{}',
  });
}

export function importReportUrl(importId: string): string {
  return `/api/imports/${encodeURIComponent(importId)}/report`;
}
