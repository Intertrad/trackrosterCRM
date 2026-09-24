import { browserJson } from './browser-json';
import type {
  ExportDownload,
  ExportJob,
  ExportJobPage,
  ExportPreview,
  ExportRequest,
} from './export-types';

function writeHeaders(idempotencyKey?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey ?? crypto.randomUUID(),
  };
}

export function listExports(
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ExportJobPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<ExportJobPage>(search ? `/api/exports?${search}` : '/api/exports', {
    cache: 'no-store',
    signal,
  });
}

export function getExport(exportId: string, signal?: AbortSignal): Promise<ExportJob> {
  return browserJson<ExportJob>(`/api/exports/${encodeURIComponent(exportId)}`, {
    cache: 'no-store',
    signal,
  });
}

/** A dry run: returns what would be exported without creating a job. */
export function previewExport(
  request: ExportRequest,
  signal?: AbortSignal,
): Promise<ExportPreview> {
  return browserJson<ExportPreview>('/api/exports/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
}

/**
 * Queues an export.
 *
 * Answers 202: the file is produced asynchronously, so the caller polls the
 * job rather than expecting content here.
 */
export function createExport(request: ExportRequest, idempotencyKey: string): Promise<ExportJob> {
  return browserJson<ExportJob>('/api/exports', {
    method: 'POST',
    headers: writeHeaders(idempotencyKey),
    body: JSON.stringify(request),
  });
}

export function cancelExport(exportId: string): Promise<ExportJob> {
  return browserJson<ExportJob>(`/api/exports/${encodeURIComponent(exportId)}/cancel`, {
    method: 'POST',
    headers: writeHeaders(),
    body: '{}',
  });
}

/**
 * Mints a short-lived download link.
 *
 * The API re-checks the requester's authority here, so this can fail even on
 * a completed job — that is the control working, not an error to swallow.
 */
export function requestExportDownload(exportId: string): Promise<ExportDownload> {
  return browserJson<ExportDownload>(`/api/exports/${encodeURIComponent(exportId)}/download`, {
    cache: 'no-store',
  });
}
