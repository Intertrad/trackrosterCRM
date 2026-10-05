import type {
  ProspectFollowUp,
  ProspectFollowUpCategory,
  ProspectFollowUpChannel,
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

  category: ProspectFollowUpCategory;

  channel: ProspectFollowUpChannel | null;

  status: ProspectFollowUpStatus;

  reviewStatus: 'none' | 'pending';

  completedLate: boolean;

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

    category: followUp.category,

    channel: followUp.channel,

    status: followUp.status,

    reviewStatus: followUp.reviewStatus,

    completedLate: followUp.completedLate,

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

export interface ProspectFollowUpQueueItem extends PublicProspectFollowUp {
  campaignName: string;

  establishmentName: string;
}

export interface ProspectFollowUpQueueResponse {
  items: ProspectFollowUpQueueItem[];
}
