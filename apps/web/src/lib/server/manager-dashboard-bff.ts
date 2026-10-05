import type {
  ManagerDashboardAuthority,
  ManagerDashboardResponse,
} from '@/lib/api/manager-dashboard-types';

export interface BackendManagerDashboardResponse {
  generatedAt: string;

  range: {
    from: string;
    to: string;
  };

  scope: {
    authority: ManagerDashboardAuthority;
    organizationId: string | null;
    teamId: string | null;
  };

  filters: {
    organizationId: string | null;
    teamId: string | null;
    userId: string | null;
    campaignId: string | null;
  };

  activities: {
    total: number;
    byType: Record<string, number>;
    activeProspectors: number;
  };

  assignments: {
    current: number;
    individuallyAssigned: number;
    teamOwned: number;
  };

  followUps: {
    pending: number;
    overdue: number;
    dueInRange: number;
    completedInRange: number;
    lateCompletedInRange?: number;
    cancelledInRange: number;
  };

  byProspector: Array<{
    userId: string;
    activities: number;
    currentAssignments: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
    lateCompletedFollowUps?: number;
  }>;
}

const MANAGER_DASHBOARD_QUERY_KEYS = new Set([
  'from',
  'to',
  'organizationId',
  'teamId',
  'userId',
  'campaignId',
]);

export function buildManagerDashboardBackendPath(request: Request): string {
  const requestUrl = new URL(request.url);

  const query = new URLSearchParams();

  /*
   * Preserve supported query parameters exactly.
   *
   * Do not parse UUIDs or dates here.
   * Nest remains authoritative for validation.
   *
   * Unknown browser query parameters never cross
   * the BFF boundary.
   */
  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (MANAGER_DASHBOARD_QUERY_KEYS.has(key)) {
      query.append(key, value);
    }
  }

  const queryString = query.toString();

  return queryString ? `/manager/dashboard?${queryString}` : '/manager/dashboard';
}

export function toBrowserManagerDashboard(
  dashboard: BackendManagerDashboardResponse,
): ManagerDashboardResponse {
  return {
    generatedAt: dashboard.generatedAt,

    range: {
      from: dashboard.range.from,
      to: dashboard.range.to,
    },

    scope: {
      authority: dashboard.scope.authority,
      organizationId: dashboard.scope.organizationId,
      teamId: dashboard.scope.teamId,
    },

    filters: {
      organizationId: dashboard.filters.organizationId,
      teamId: dashboard.filters.teamId,
      userId: dashboard.filters.userId,
      campaignId: dashboard.filters.campaignId,
    },

    activities: {
      total: dashboard.activities.total,

      byType: {
        ...dashboard.activities.byType,
      },

      activeProspectors: dashboard.activities.activeProspectors,
    },

    assignments: {
      current: dashboard.assignments.current,
      individuallyAssigned: dashboard.assignments.individuallyAssigned,
      teamOwned: dashboard.assignments.teamOwned,
    },

    followUps: {
      pending: dashboard.followUps.pending,
      overdue: dashboard.followUps.overdue,
      dueInRange: dashboard.followUps.dueInRange,
      completedInRange: dashboard.followUps.completedInRange,
      ...(dashboard.followUps.lateCompletedInRange === undefined
        ? {}
        : { lateCompletedInRange: dashboard.followUps.lateCompletedInRange }),
      cancelledInRange: dashboard.followUps.cancelledInRange,
    },

    byProspector: dashboard.byProspector.map((prospector) => ({
      userId: prospector.userId,
      activities: prospector.activities,
      currentAssignments: prospector.currentAssignments,
      pendingFollowUps: prospector.pendingFollowUps,
      overdueFollowUps: prospector.overdueFollowUps,
      ...(prospector.lateCompletedFollowUps === undefined
        ? {}
        : { lateCompletedFollowUps: prospector.lateCompletedFollowUps }),
    })),
  };
}
