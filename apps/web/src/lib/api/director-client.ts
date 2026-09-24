import { browserJson } from './browser-json';
import type { DirectorDashboard } from './director-types';

export interface DirectorDashboardQuery {
  from?: string;
  to?: string;
  organizationId?: string;
  teamId?: string;
  userId?: string;
  campaignId?: string;
}

export function getDirectorDashboard(
  query: DirectorDashboardQuery = {},
  signal?: AbortSignal,
): Promise<DirectorDashboard> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<DirectorDashboard>(
    search ? `/api/dashboard/director?${search}` : '/api/dashboard/director',
    { cache: 'no-store', signal },
  );
}
