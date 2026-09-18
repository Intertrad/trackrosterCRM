export interface WorkQueueItem {
  assignmentId: string;
  campaignProspectId: string;
  assignedAt: string;

  campaign: {
    id: string;
    name: string;
  };

  establishment: {
    id: string;
    name: string;
    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;
    phone: string | null;
    website: string | null;
    latitude: number | null;
    longitude: number | null;
  };

  primaryContact: {
    id: string;
    name: string | null;
    jobTitle: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface WorkQueueResponse {
  items: WorkQueueItem[];
  nextCursor: string | null;
}
