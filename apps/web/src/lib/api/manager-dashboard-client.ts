import { browserJson } from './browser-json';

import type { ManagerDashboardQuery, ManagerDashboardResponse } from './manager-dashboard-types';

function buildManagerDashboardQuery(input: ManagerDashboardQuery): string {
  const query = new URLSearchParams();

  if (input.from !== undefined) {
    query.set('from', input.from);
  }

  if (input.to !== undefined) {
    query.set('to', input.to);
  }

  if (input.organizationId !== undefined) {
    query.set('organizationId', input.organizationId);
  }

  if (input.teamId !== undefined) {
    query.set('teamId', input.teamId);
  }

  if (input.userId !== undefined) {
    query.set('userId', input.userId);
  }

  if (input.campaignId !== undefined) {
    query.set('campaignId', input.campaignId);
  }

  return query.toString();
}

export async function getManagerDashboard(
  input: ManagerDashboardQuery = {},
  signal?: AbortSignal,
): Promise<ManagerDashboardResponse> {
  const query = buildManagerDashboardQuery(input);

  const path = query ? `/api/manager/dashboard?${query}` : '/api/manager/dashboard';

  return browserJson<ManagerDashboardResponse>(path, {
    method: 'GET',

    signal,
    cache: 'no-store',
  });
}
