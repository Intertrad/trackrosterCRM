export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'departed';

/**
 * GET /memberships — the tenant's people.
 *
 * This is the source of real member identity for the manager screens: the
 * reporting endpoint returns only opaque user ids, while this row carries the
 * display name, roles and capacity target.
 */
export interface MembershipSummary {
  id: string;
  identityId: string;
  email: string;
  displayName: string | null;
  status: MembershipStatus;
  roles: string[];

  /** Individual workload target; null when none has been set. */
  capacity: number | null;
}

export interface MembershipPage {
  items: MembershipSummary[];
  nextCursor: string | null;
}

export interface ListMembershipsQuery {
  teamId?: string;
  organizationId?: string;
  territoryId?: string;
  campaignId?: string;
  role?: string;
  status?: MembershipStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

export type ScopeType = 'tenant' | 'organization' | 'team' | 'territory' | 'campaign';

export type ScopeAccessLevel = 'read' | 'read_write' | 'manage';

/** One structural grant: a role held at a tenant, organization or team. */
export interface MembershipGrant {
  grantId: string;
  role: string;
  scopeType: ScopeType;
  organizationId: string | null;
  teamId: string | null;
  permissions: string[];
}

/**
 * GET /memberships/:membershipId
 *
 * Carries what the list cannot: the effective grants behind a role badge, the
 * live assignment count and the invitation lifecycle timestamps.
 *
 * `scopes` is returned by the API's own effective-permission resolver, so its
 * exact shape is wider than the grants the access drawer renders; the extra
 * keys are preserved rather than narrowed away.
 */
export interface MembershipDetail {
  id: string;
  tenantId: string;
  identityId: string;
  email: string;
  identityStatus: string;
  displayName: string | null;
  status: MembershipStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  departedAt: string | null;
  updatedAt: string;
  capacity: number | null;
  activeAssignments: number;
  availableCapacity: number | null;
  scopes: {
    structural?: MembershipGrant[];
    resources?: unknown[];
    [key: string]: unknown;
  };
  rosterHistory: {
    items: Array<Record<string, unknown>>;
    truncated: boolean;
  };
}

export interface InviteMembershipInput {
  email: string;
  role: string;
  organizationId?: string;
  teamId?: string;
  displayName?: string;
}

export interface UpdateMembershipInput {
  displayName?: string;
  capacity?: number | null;
  status?: 'active' | 'suspended' | 'departed';
  role?: string;
  scopeType?: 'tenant' | 'organization' | 'team';
  organizationId?: string;
  teamId?: string;
  /** The API requires 3–1000 characters whenever access actually changes. */
  reason?: string;
}

export const MIN_REASON_LENGTH = 3;

export const MAX_REASON_LENGTH = 1000;

export function membershipName(member: { displayName: string | null; email: string }): string {
  return member.displayName?.trim() || member.email;
}

export function membershipInitials(member: { displayName: string | null; email: string }): string {
  const source = membershipName(member);

  const parts = source.split(/[\s@._-]+/).filter(Boolean);

  const initials = parts.slice(0, 2).map((part) => part.charAt(0));

  return (initials.join('') || source.charAt(0)).toUpperCase();
}
