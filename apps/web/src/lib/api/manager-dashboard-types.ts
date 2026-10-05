export type ManagerDashboardAuthority = 'client_admin' | 'director' | 'manager';

export interface ManagerDashboardQuery {
  /*
   * ISO-8601 timestamps.
   *
   * Both must be supplied together or both omitted.
   *
   * Backend semantics:
   *
   *   from <= timestamp < to
   */
  from?: string;

  to?: string;

  organizationId?: string;

  teamId?: string;

  userId?: string;

  campaignId?: string;
}

export interface ManagerDashboardRange {
  from: string;

  to: string;
}

export interface ManagerDashboardScope {
  /*
   * Effective server-resolved reporting authority.
   *
   * This is authoritative.
   */
  authority: ManagerDashboardAuthority;

  organizationId: string | null;

  teamId: string | null;
}

export interface ManagerDashboardFilters {
  /*
   * Authorized request filters echoed by the backend.
   *
   * Omitted filters are represented as null.
   */
  organizationId: string | null;

  teamId: string | null;

  userId: string | null;

  campaignId: string | null;
}

export interface ManagerDashboardActivitySummary {
  total: number;

  /*
   * Activity types are intentionally open-ended.
   *
   * Do not hard-code the backend activity enum here.
   */
  byType: Record<string, number>;

  activeProspectors: number;
}

export interface ManagerDashboardAssignmentSummary {
  /*
   * Current assignments only.
   */
  current: number;

  individuallyAssigned: number;

  teamOwned: number;
}

export interface ManagerDashboardFollowUpSummary {
  /*
   * Current pending snapshot.
   */
  pending: number;

  /*
   * Pending follow-ups where dueAt < generatedAt.
   */
  overdue: number;

  /*
   * Period metrics within the response range.
   */
  dueInRange: number;

  completedInRange: number;

  lateCompletedInRange?: number;

  cancelledInRange: number;
}

export interface ManagerDashboardProspectorRow {
  userId: string;

  activities: number;

  currentAssignments: number;

  pendingFollowUps: number;

  overdueFollowUps: number;

  lateCompletedFollowUps?: number;
}

export interface ManagerDashboardResponse {
  /*
   * Server timestamp defining this dashboard snapshot.
   *
   * It also defines the backend's overdue boundary.
   */
  generatedAt: string;

  range: ManagerDashboardRange;

  scope: ManagerDashboardScope;

  filters: ManagerDashboardFilters;

  activities: ManagerDashboardActivitySummary;

  assignments: ManagerDashboardAssignmentSummary;

  followUps: ManagerDashboardFollowUpSummary;

  byProspector: ManagerDashboardProspectorRow[];
}
