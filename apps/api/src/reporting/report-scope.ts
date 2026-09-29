import { eq, type SQL } from 'drizzle-orm';

import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import type { ManagerDashboardReportInput } from './manager-dashboard.types.js';

/**
 * The authority predicate every reporting query must carry.
 *
 * This is the single point where a manager is confined to their team and a
 * director to their organization. It lives on its own so the dashboard and
 * the per-report queries cannot drift apart: a report that forgot one of
 * these clauses would quietly return another team's numbers.
 *
 * Both the server-resolved scope and the caller's own filters are applied.
 * The caller's filters are authorized before any query runs, so re-applying
 * them here is defence in depth rather than the actual check.
 */
export function addAssignmentScopeConditions(
  conditions: SQL[],
  input: ManagerDashboardReportInput,
): void {
  if (input.scope.organizationId) {
    conditions.push(eq(campaignProspectAssignments.organizationId, input.scope.organizationId));
  }

  if (input.scope.teamId) {
    conditions.push(eq(campaignProspectAssignments.teamId, input.scope.teamId));
  }

  if (input.filters.organizationId) {
    conditions.push(eq(campaignProspectAssignments.organizationId, input.filters.organizationId));
  }

  if (input.filters.teamId) {
    conditions.push(eq(campaignProspectAssignments.teamId, input.filters.teamId));
  }
}
