import type { EstablishmentStatus } from '../database/schema/establishments.js';

export interface WorkQueueItem {
  campaignProspectId: string;

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
