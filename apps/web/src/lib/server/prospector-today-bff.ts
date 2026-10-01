import type {
  ProspectorTodayCategory,
  ProspectorTodayCompleted,
  ProspectorTodayChannel,
  ProspectorTodayResponse,
} from '@/lib/api/prospector-today-types';

export interface BackendProspectorTodayResponse {
  completed?: ProspectorTodayCompleted[];

  generatedAt: string;

  day: {
    date: string;

    timeZone: string;

    startsAt: string;

    endsAt: string;
  };

  summary: {
    actionsLeft: number;

    toDo: number;

    followUps: number;

    meetings: number;

    overdue: number;

    /* Optional so this proxy still compiles against an API build that
     * predates the field. */
    completedToday?: number;
  };

  priorities: Array<{
    id: string;

    campaignId: string;

    campaignProspectId: string;

    dueAt: string;

    isOverdue: boolean;

    category: ProspectorTodayCategory;

    channel: ProspectorTodayChannel | null;

    establishment: {
      id: string;

      name: string;

      city: string | null;

      phone?: string | null;

      latitude?: number | null;

      longitude?: number | null;
    };
  }>;
}

export function toBrowserProspectorTodayResponse(
  response: BackendProspectorTodayResponse,
): ProspectorTodayResponse {
  return {
    generatedAt: response.generatedAt,
    completed: (response.completed ?? []).map(
      ({ id, campaignId, campaignProspectId, completedAt, channel, establishmentName }) => ({
        id,
        campaignId,
        campaignProspectId,
        completedAt,
        channel,
        establishmentName,
      }),
    ),
    day: {
      date: response.day.date,
      timeZone: response.day.timeZone,
      startsAt: response.day.startsAt,
      endsAt: response.day.endsAt,
    },
    summary: {
      actionsLeft: response.summary.actionsLeft,
      toDo: response.summary.toDo,
      followUps: response.summary.followUps,
      meetings: response.summary.meetings,
      overdue: response.summary.overdue,
      /* Older API builds omit this; treat absence as nothing done yet
       * rather than letting undefined reach the browser. */
      completedToday: response.summary.completedToday ?? 0,
    },
    priorities: response.priorities.map((priority) => ({
      id: priority.id,
      campaignId: priority.campaignId,
      campaignProspectId: priority.campaignProspectId,
      dueAt: priority.dueAt,
      isOverdue: priority.isOverdue,
      category: priority.category,
      channel: priority.channel,
      establishment: {
        id: priority.establishment.id,
        name: priority.establishment.name,
        city: priority.establishment.city,
        /* Absent on an API build that predates the dialling hand-off, which
         * the row handles by opening the prospect instead. */
        phone: priority.establishment.phone ?? null,
        /* Absent on an API build that predates the map, which the day's
         * visits handles by simply not plotting that stop. */
        latitude: priority.establishment.latitude ?? null,
        longitude: priority.establishment.longitude ?? null,
      },
    })),
  };
}
