export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface Campaign {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
}

export interface CampaignPage {
  items: Campaign[];
  nextCursor: string | null;
}

export interface ListCampaignsQuery {
  organizationId?: string;
  territoryId?: string;
  status?: CampaignStatus;
  search?: string;
  startsAfter?: string;
  startsBefore?: string;
  sort?: 'name' | 'createdAt';
  cursor?: string;
  limit?: number;
}

export interface CreateCampaignInput {
  organizationId: string;
  name: string;
  description?: string | null;
  /** Serialised as ISO; the API parses it with @Type(() => Date). */
  startsAt?: string | null;
  endsAt?: string | null;
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'organizationId'>> & {
  status?: CampaignStatus;
};

/*
 * Status is changed through its own endpoint rather than PATCH, because the
 * API records a reason against the transition.
 */
export const MIN_STATUS_REASON = 3;

export const MAX_STATUS_REASON = 1000;

export type CampaignMemberRole = 'member' | 'coordinator' | 'observer';

export type ParticipationState = 'active' | 'scheduled' | 'ended' | 'revoked';

export interface CampaignMember {
  id: string;
  tenantId: string;
  campaignId: string;
  membershipId: string | null;
  teamId: string | null;
  role: CampaignMemberRole;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  state: ParticipationState;
  etag?: string;
}

export interface CampaignMemberPage {
  items: CampaignMember[];
  nextCursor: string | null;
}

export type CampaignAccessMode = 'participate' | 'read_only';

export interface CampaignOrganization {
  id: string;
  tenantId: string;
  campaignId: string;
  organizationId: string;
  accessMode: CampaignAccessMode;
  endedAt?: string | null;
  etag?: string;
}

export interface CampaignOrganizationPage {
  items: CampaignOrganization[];
  nextCursor: string | null;
}

/** Upstream caps one allocation request at 100 prospects. */
export const MAX_ALLOCATION_PROSPECTS = 100;

export interface AllocationResult {
  [key: string]: unknown;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export function campaignStatusLabel(status: CampaignStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function campaignStatusTone(
  status: CampaignStatus,
): 'success' | 'warning' | 'neutral' | 'brand' {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'draft':
      return 'brand';
    default:
      return 'neutral';
  }
}

/**
 * Which status transitions the API will accept.
 *
 * Archived is terminal and completed only reopens by archiving, so offering
 * every status on every campaign would produce guaranteed rejections.
 */
export function allowedTransitions(status: CampaignStatus): CampaignStatus[] {
  switch (status) {
    case 'draft':
      return ['active', 'archived'];
    case 'active':
      return ['paused', 'completed', 'archived'];
    case 'paused':
      return ['active', 'completed', 'archived'];
    case 'completed':
      return ['archived'];
    default:
      return [];
  }
}

export function memberRoleLabel(role: CampaignMemberRole): string {
  return role === 'coordinator' ? 'Coordinator' : role === 'observer' ? 'Observer' : 'Member';
}
