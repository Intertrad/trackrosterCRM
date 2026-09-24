import { browserJson } from './browser-json';
import type { ReportEnvelope, ReportKey } from './report-types';

export interface ReportFilters {
  from?: string;
  to?: string;
  organizationId?: string;
  teamId?: string;
  userId?: string;
  campaignId?: string;
}

export function getReport<T>(
  report: ReportKey,
  filters: ReportFilters = {},
  signal?: AbortSignal,
): Promise<ReportEnvelope<T>> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  const path = `/api/reports/${encodeURIComponent(report)}`;

  return browserJson<ReportEnvelope<T>>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}
