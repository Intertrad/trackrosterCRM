import type {
  ProspectActivity,
  ProspectActivityType,
} from '../database/schema/prospect-activities.js';

export interface ProspectTimelineCursor {
  occurredAt: Date;
  createdAt: Date;
  id: string;
}

export interface ProspectTimelineRepositoryOptions {
  limit: number;
  cursor?: ProspectTimelineCursor | null;
}

export interface ProspectTimelineRepositoryPage {
  items: ProspectActivity[];
  nextCursor: ProspectTimelineCursor | null;
}

export interface ProspectTimelineActivityItem {
  kind: 'activity';

  id: string;

  occurredAt: string;

  activityType: ProspectActivityType;

  actor: {
    userId: string;
  };

  context: {
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignmentId: string;
  };
}

export interface ProspectTimelinePage {
  items: ProspectTimelineActivityItem[];

  nextCursor: string | null;
}
