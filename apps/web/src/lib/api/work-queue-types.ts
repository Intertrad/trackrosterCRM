export type WorkQueueEstablishmentStatus = 'active' | 'inactive' | 'archived';

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

    /*
     * Nest serializes backend Date values as ISO strings.
     */
    assignedAt: string;
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

    status: WorkQueueEstablishmentStatus;
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
