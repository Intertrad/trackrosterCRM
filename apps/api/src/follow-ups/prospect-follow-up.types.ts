import type {
  ProspectFollowUp,
  ProspectFollowUpStatus,
} from '../database/schema/prospect-follow-ups.js';

export interface PublicProspectFollowUp {
  id: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignedUserId: string | null;

  createdBy: string;

  dueAt: string;

  status: ProspectFollowUpStatus;

  completedAt: string | null;

  cancelledAt: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface ProspectFollowUpListResponse {
  items: PublicProspectFollowUp[];
}

export function toPublicProspectFollowUp(followUp: ProspectFollowUp): PublicProspectFollowUp {
  return {
    id: followUp.id,

    campaignId: followUp.campaignId,

    campaignProspectId: followUp.campaignProspectId,

    establishmentId: followUp.establishmentId,

    assignedUserId: followUp.assignedUserId,

    createdBy: followUp.createdBy,

    dueAt: followUp.dueAt.toISOString(),

    status: followUp.status,

    completedAt: followUp.completedAt ? followUp.completedAt.toISOString() : null,

    cancelledAt: followUp.cancelledAt ? followUp.cancelledAt.toISOString() : null,

    createdAt: followUp.createdAt.toISOString(),

    updatedAt: followUp.updatedAt.toISOString(),
  };
}

export interface FollowUpTeamScope {
  organizationId: string;

  teamId: string;
}

export interface ProspectFollowUpQueueOptions {
  userId: string;

  teamScopes: FollowUpTeamScope[];

  overdue?: boolean;

  now: Date;

  limit: number;
}

export interface ProspectFollowUpQueueResponse {
  items: PublicProspectFollowUp[];
}
