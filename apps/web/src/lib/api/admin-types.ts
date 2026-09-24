/**
 * GET /dashboard/admin
 *
 * Operational counts for the tenant. The backend states plainly that this is
 * "operational counts only" — it carries no seat limit, no MFA coverage and
 * no data-quality percentage, so the overview screen must not imply any.
 */
export interface AdminDashboardMetrics {
  activeMembers: number;
  sessionsLast30Days: number;
  activeOrganizations: number;
  activeTeams: number;
  activeCampaigns: number;
  prospectsMissingCoordinates: number;
  prospectsMissingPhone: number;
  failedExports: number;
  importsAwaitingCommit: number;
}

export interface AdminDashboard {
  generatedAt: string;
  scope: { tenantId: string };
  metrics: AdminDashboardMetrics;
  readiness: {
    productionCertified: boolean;
    checks: string;
  };
}
