export type TeamStatus = 'active' | 'inactive';

export interface Team {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  status: TeamStatus;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
}

export interface TeamPage {
  items: Team[];
  nextCursor: string | null;
}

/** Membership of a team over a period; a person can be rostered more than once. */
export type RosterState = 'active' | 'scheduled' | 'ended' | 'revoked';

export type TeamRole = 'manager' | 'member';

export interface RosterEntry {
  id: string;
  tenantId: string;
  teamId: string;
  membershipId: string;
  teamRole: TeamRole;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  state: RosterState;
  etag: string;
}

export interface RosterPage {
  items: RosterEntry[];
  nextCursor: string | null;
}

/**
 * GET /teams/:teamId/capacity
 *
 * `available` is null when a member has no capacity target — that is "not
 * measured", which must not be rendered as zero headroom.
 */
export interface TeamCapacityMember {
  membershipId: string;
  identityId?: string;
  displayName: string | null;
  email?: string;
  status: string;
  identityStatus: string;
  capacity: number | null;
  globalWorkload: number | string;
  eligible: boolean;
  available: number | null;
}

export interface TeamCapacity {
  paused: number;
  teamOwned: number;
  members: {
    items: TeamCapacityMember[];
    truncated: boolean;
  };
  [key: string]: unknown;
}

export function rosterStateTone(state: RosterState): 'success' | 'warning' | 'neutral' {
  if (state === 'active') {
    return 'success';
  }

  if (state === 'scheduled') {
    return 'warning';
  }

  return 'neutral';
}

/** Percentage of a member's target that is consumed; null when untargeted. */
export function utilisationPercent(member: TeamCapacityMember): number | null {
  if (member.capacity === null || member.capacity === 0) {
    return null;
  }

  return Math.round((Number(member.globalWorkload) / member.capacity) * 100);
}
