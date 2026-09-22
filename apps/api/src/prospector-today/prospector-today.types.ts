import type {
  ProspectFollowUpCategory,
  ProspectFollowUpChannel,
} from '../database/schema/prospect-follow-ups.js';

export interface ProspectorTodaySummary {
  actionsLeft: number;

  toDo: number;

  followUps: number;

  meetings: number;

  overdue: number;
}

export interface ProspectorTodayPriority {
  id: string;

  campaignId: string;

  campaignProspectId: string;

  dueAt: string;

  isOverdue: boolean;

  category: ProspectFollowUpCategory;

  channel: ProspectFollowUpChannel | null;

  establishment: {
    id: string;

    name: string;

    city: string | null;
  };
}

export interface ProspectorTodayResponse {
  generatedAt: string;

  day: {
    date: string;

    timeZone: string;

    startsAt: string;

    endsAt: string;
  };

  summary: ProspectorTodaySummary;

  priorities: ProspectorTodayPriority[];
}
