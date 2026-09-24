import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { getInitials } from '@/lib/ui/initials';
import { getRoleLabel } from '@/lib/ui/roles';

export interface TeamRosterRow {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: MembershipSummary['status'];

  activeProspects: number;
  actionsThisPeriod: number;
  overdue: number;

  /** null when the member has no capacity target set. */
  capacityPercent: number | null;
}

/**
 * Joins the reporting figures to real people.
 *
 * GET /manager/dashboard returns per-prospector rows keyed by membership id
 * with no name or target, and GET /memberships carries the identity and the
 * capacity target. Neither is sufficient alone, so they are merged here and
 * the screens consume one shape.
 */
export function buildTeamRoster(
  memberships: MembershipSummary[],
  dashboard: ManagerDashboardResponse | null,
): TeamRosterRow[] {
  const metrics = new Map((dashboard?.byProspector ?? []).map((row) => [row.userId, row]));

  return memberships
    .filter((membership) => membership.status !== 'departed')
    .map((membership) => {
      const row = metrics.get(membership.id);

      const activeProspects = row?.currentAssignments ?? 0;

      return {
        id: membership.id,
        name: membership.displayName ?? membership.email,
        initials: getInitials(membership.displayName, membership.email),
        role: membership.roles[0] ? getRoleLabel(membership.roles[0]) : 'Member',
        status: membership.status,
        activeProspects,
        actionsThisPeriod: row?.activities ?? 0,
        overdue: row?.overdueFollowUps ?? 0,

        /*
         * Utilisation is only meaningful against a target. Without one the
         * screens show an em dash rather than implying a full workload.
         */
        capacityPercent:
          membership.capacity && membership.capacity > 0
            ? Math.round((activeProspects / membership.capacity) * 100)
            : null,
      };
    });
}

/** The design reads 85% or more as at risk. */
export function rosterStatus(row: TeamRosterRow): 'at_risk' | 'inactive' | 'on_track' {
  if (row.capacityPercent !== null && row.capacityPercent >= 85) {
    return 'at_risk';
  }

  if (row.actionsThisPeriod === 0) {
    return 'inactive';
  }

  return 'on_track';
}
