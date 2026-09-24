export type ExportType = 'assignments' | 'activities' | 'follow_ups';

export type ExportFormat = 'csv' | 'xlsx';

export type ExportStatus =
  'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';

/**
 * A controlled export.
 *
 * "Controlled" is the point: the job records the authority it was created
 * under, and the API re-checks that the requester's authority is unchanged
 * before releasing the file. A promotion or a scope change between request
 * and download invalidates it rather than silently widening what was taken.
 */
export interface ExportJob {
  id: string;
  tenantId: string;
  requesterId: string;
  status: ExportStatus;
  request: Record<string, unknown>;
  filename: string | null;
  contentType: string | null;
  rowCount: number | null;
  failureCode: string | null;
  attempts: number;
  downloadExpiresAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportJobPage {
  items: ExportJob[];
  nextCursor: string | null;
}

export interface ExportRequest {
  type: ExportType;
  format?: ExportFormat;
  /** ISO instants; the API parses with @Type(() => Date). */
  from?: string;
  to?: string;
  organizationId?: string;
  teamId?: string;
  userId?: string;
  campaignId?: string;
  /** Column allow-list; the API caps it at 40. */
  fields?: string[];
}

export const MAX_EXPORT_FIELDS = 40;

export interface ExportPreview {
  rowCount?: number;
  columns?: string[];
  sample?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** A short-lived, single-use link the API mints on request. */
export interface ExportDownload {
  url: string;
  expiresAt: string;
  filename: string | null;
}

const TYPE_LABELS: Record<ExportType, string> = {
  assignments: 'Assignments',
  activities: 'Activities',
  follow_ups: 'Follow-ups',
};

export function exportTypeLabel(type: ExportType): string {
  return TYPE_LABELS[type] ?? type;
}

export function exportStatusTone(
  status: ExportStatus,
): 'success' | 'danger' | 'warning' | 'brand' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'processing':
    case 'queued':
      return 'brand';
    case 'expired':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** A job still moving; the list polls only while one of these exists. */
export function isExportRunning(job: ExportJob): boolean {
  return job.status === 'queued' || job.status === 'processing';
}

/**
 * Whether the file can still be fetched.
 *
 * A completed job whose retention window has passed is `expired` upstream,
 * but the window can lapse between the list being read and the button being
 * pressed — so the expiry is checked here too rather than trusting status
 * alone.
 */
export function canDownload(job: ExportJob, now: number = Date.now()): boolean {
  if (job.status !== 'completed') {
    return false;
  }

  if (!job.expiresAt) {
    return true;
  }

  const expiry = new Date(job.expiresAt).getTime();

  return Number.isNaN(expiry) ? true : expiry > now;
}

export function canCancel(job: ExportJob): boolean {
  return isExportRunning(job);
}

const FAILURE_MESSAGES: Record<string, string> = {
  authority_changed: 'Your access changed after this export was requested, so it was not released.',
  too_many_rows: 'The result was larger than an export allows. Narrow the date range.',
  no_rows: 'Nothing matched this request.',
};

/** Turns the stored failure code into something an operator can act on. */
export function describeFailure(job: ExportJob): string {
  if (!job.failureCode) {
    return 'This export did not complete.';
  }

  return (
    FAILURE_MESSAGES[job.failureCode] ??
    `This export failed (${job.failureCode.replace(/_/g, ' ')}).`
  );
}
