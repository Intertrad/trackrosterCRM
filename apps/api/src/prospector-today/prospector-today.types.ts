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

  /** Follow-ups completed within the caller's local day. */
  completedToday: number;
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

    /*
     * Numeric columns arrive from the driver as strings. They are published
     * as numbers so a client never has to guess, and null when the
     * establishment has never been geocoded.
     */
    latitude: number | null;

    longitude: number | null;
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
