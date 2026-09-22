import type { EstablishmentStatus } from '../database/schema/establishments.js';
import type { CampaignProspectLifecycleStage } from '../database/schema/campaign-prospects.js';
import type { ProspectActivityType } from '../database/schema/prospect-activities.js';

export interface WorkQueueLatestActivity {
  type: ProspectActivityType;

  occurredAt: Date;
}

export interface WorkQueueNextFollowUp {
  id: string;

  dueAt: Date;
}

export interface WorkQueueCampaignOption {
  id: string;

  name: string;
}

export interface WorkQueueOptionsResponse {
  campaigns: WorkQueueCampaignOption[];
}
export interface WorkQueueItem {
  campaignProspectId: string;

  lifecycleStage: CampaignProspectLifecycleStage;

  latestActivity: WorkQueueLatestActivity | null;

  nextFollowUp: WorkQueueNextFollowUp | null;

  campaign: {
    id: string;
    name: string;
  };

  assignment: {
    id: string;

    organizationId: string;

    teamId: string;

    assignedAt: Date;
  };

  establishment: {
    id: string;

    regionId: string | null;

    name: string;

    addressLine1: string | null;

    postalCode: string | null;

    city: string | null;

    countryCode: string;

    latitude: number | null;

    longitude: number | null;

    phone: string | null;

    website: string | null;

    status: EstablishmentStatus;
  };
}

/*
 * Prospect Detail intentionally has its own explicit
 * contract instead of aliasing WorkQueueItem.
 *
 * This prevents future Work Queue list changes from
 * silently expanding the detail API response.
 */
export interface WorkQueueProspectDetail {
  campaignProspectId: string;

  lifecycleStage: CampaignProspectLifecycleStage;

  latestActivity: WorkQueueLatestActivity | null;

  campaign: {
    id: string;
    name: string;
  };

  assignment: {
    id: string;

    organizationId: string;

    teamId: string;

    assignedAt: Date;
  };

  establishment: {
    id: string;

    regionId: string | null;

    name: string;

    addressLine1: string | null;

    postalCode: string | null;

    city: string | null;

    countryCode: string;

    latitude: number | null;

    longitude: number | null;

    phone: string | null;

    website: string | null;

    status: EstablishmentStatus;
  };
}

export interface WorkQueuePage {
  limit: number;

  hasMore: boolean;

  nextCursor: string | null;
}

export interface WorkQueueResponse {
  items: WorkQueueItem[];

  page: WorkQueuePage;
}

export interface WorkQueueCursor {
  assignedAt: string;

  assignmentId: string;
}
