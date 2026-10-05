export type ManagerDashboardAuthorityRole = 'client_admin' | 'director' | 'manager';

export interface ManagerDashboardDateRange {
  /*
   * Half-open reporting range:
   *
   * from <= timestamp < to
   */
  from: Date;

  to: Date;
}

export interface ManagerDashboardFilters {
  organizationId?: string;

  teamId?: string;

  userId?: string;

  campaignId?: string;
}

/*
 * Resolved server-side reporting scope.
 *
 * This is deliberately separate from the raw
 * request filters.
 *
 * Example:
 *
 * Manager request:
 *
 *   teamId omitted
 *
 * Effective scope:
 *
 *   authority = manager
 *   organizationId = manager's organization
 *   teamId = manager's exact team
 *
 * The frontend can never widen this object.
 */
export interface ManagerDashboardScope {
  authority: ManagerDashboardAuthorityRole;

  organizationId: string | null;

  teamId: string | null;
}

export interface ManagerDashboardActivitySummary {
  total: number;

  /*
   * We intentionally do not duplicate the database
   * activity enum here.
   *
   * Reporting should group the actual persisted
   * activity types and remain forward-compatible
   * when new activity types are added.
   */
  byType: Record<string, number>;

  activeProspectors: number;
}

export interface ManagerDashboardAssignmentSummary {
  /*
   * Current assignments only:
   *
   * endedAt IS NULL
   */
  current: number;

  /*
   * assignedUserId IS NOT NULL
   */
  individuallyAssigned: number;

  /*
   * assignedUserId IS NULL
   */
  teamOwned: number;
}

export interface ManagerDashboardFollowUpSummary {
  /*
   * Current snapshot:
   *
   * status = pending
   */
  pending: number;

  /*
   * Current snapshot:
   *
   * status = pending
   * AND dueAt < generatedAt
   */
  overdue: number;

  /*
   * Period metric:
   *
   * status = pending
   * AND from <= dueAt < to
   */
  dueInRange: number;

  /*
   * Period metric:
   *
   * status = completed
   * AND from <= completedAt < to
   */
  completedInRange: number;

  /** Completed after an overdue manager review in the reporting window. */
  lateCompletedInRange?: number;

  /*
   * Period metric:
   *
   * status = cancelled
   * AND from <= cancelledAt < to
   */
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
   * Server timestamp at which this dashboard
   * snapshot was generated.
   *
   * This timestamp also defines "overdue".
   */
  generatedAt: string;

  range: {
    from: string;

    to: string;
  };

  /*
   * Effective authorization scope.
   *
   * This tells clients which reporting boundary was
   * actually applied.
   */
  scope: {
    authority: ManagerDashboardAuthorityRole;

    organizationId: string | null;

    teamId: string | null;
  };

  /*
   * Authorized request filters after validation.
   */
  filters: {
    organizationId: string | null;

    teamId: string | null;

    userId: string | null;

    campaignId: string | null;
  };

  activities: ManagerDashboardActivitySummary;

  assignments: ManagerDashboardAssignmentSummary;

  followUps: ManagerDashboardFollowUpSummary;

  byProspector: ManagerDashboardProspectorRow[];
}

/*
 * Internal normalized request passed from the
 * service to the reporting repository.
 *
 * Unlike the HTTP DTO:
 *
 * - date range is always present
 * - authorization scope is already resolved
 */
export interface ManagerDashboardReportInput {
  tenantId: string;

  generatedAt: Date;

  range: ManagerDashboardDateRange;

  scope: ManagerDashboardScope;

  filters: ManagerDashboardFilters;
}
