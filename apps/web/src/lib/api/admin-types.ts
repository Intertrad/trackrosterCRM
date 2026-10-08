/**
 * GET /dashboard/admin
 *
 * Operational, readiness, data-quality, and security aggregates for the
 * tenant overview. These values are computed by the canonical dashboard API
 * so the page does not need to recreate business rules in the browser.
 */
export interface AdminDashboardMetrics {
  totalEstablishments: number;
  contactedEstablishments: number;
  activeMembers: number;
  sessionsLast30Days: number;
  activeOrganizations: number;
  activeTeams: number;
  activeCampaigns: number;
  establishmentsWithoutOwner: number;
  prospectsMissingCoordinates: number;
  prospectsMissingPhone: number;
  pendingDuplicateReviews: number;
  pendingInvitations: number;
  coordinationRulesSet: number;
  coordinationPairs: number;
  incompleteOrganizations: number;
  activeScriptTemplates: number;
  mfaEnrolledMembers: number;
  mfaRequired: boolean;
  passwordMinLength: number;
  sessionMaxHours: number;
  ssoConfigured: boolean;
  failedExports: number;
  importsAwaitingCommit: number;
}

export interface AdminDashboard {
  activityByDay: Array<{ date: string; total: number }>;
  activityTimeZone: string;
  generatedAt: string;
  scope: { tenantId: string };
  metrics: AdminDashboardMetrics;
  organizations: Array<{ id: string; name: string; establishments: number }>;
  activitySummary?: {
    totalActions: number;
    periodActions: number;
    actionsToday: number;
    outcomes: Array<{ code: string; count: number }>;
    channels: Array<{ channel: string; count: number }>;
  };
  liveSummary?: {
    activeLocks: number;
    blockedLastHour: number;
    approvalsWaiting: number;
    actionsToday: number;
    usersOnline: number;
  };
  readiness: {
    productionCertified: boolean;
    checks: string;
  };
}
