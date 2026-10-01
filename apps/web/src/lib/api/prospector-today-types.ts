export type ProspectorTodayCategory = 'todo' | 'follow_up' | 'meeting';

export type ProspectorTodayChannel = 'call' | 'email' | 'message' | 'visit' | 'letter';

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

  category: ProspectorTodayCategory;

  channel: ProspectorTodayChannel | null;

  establishment: {
    id: string;

    name: string;

    city: string | null;

    /** Switchboard number, so a call can be handed to the device's dialler. */
    phone: string | null;

    /** Null when the establishment has never been geocoded. */
    latitude: number | null;

    longitude: number | null;
  };
}

export interface ProspectorTodayCompleted {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  completedAt: string;
  channel: ProspectorTodayPriority['channel'];
  establishmentName: string;
}

export interface ProspectorTodayResponse {
  completed: ProspectorTodayCompleted[];

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

/**
 * Great-circle distance in kilometres.
 *
 * The day's visits show a straight-line total, not a driving distance: no
 * routing provider is configured, so a road figure would be invented. The
 * card carries a footnote saying so for the same reason.
 */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const EARTH_RADIUS_KM = 6371;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface PlottedVisit {
  priority: ProspectorTodayPriority;
  latitude: number;
  longitude: number;
  /** Distance from the previous plotted stop; null for the first. */
  legKm: number | null;
}

/**
 * The subset of today's priorities that can actually be plotted, in due order,
 * with the leg distance between consecutive stops.
 *
 * A priority without coordinates is dropped rather than placed at (0,0) — an
 * establishment in the Gulf of Guinea is worse than one that is simply absent
 * from the map.
 */
/**
 * The day's physical stops, in due order.
 *
 * Only on-site work counts: a call or an email happens from wherever the
 * prospector is, so plotting it would inflate both the stop count and the
 * distance for a journey nobody is making.
 */
export function buildVisits(priorities: ProspectorTodayPriority[]): PlottedVisit[] {
  const visits: PlottedVisit[] = [];

  for (const priority of priorities) {
    if (priority.channel !== 'visit') {
      continue;
    }

    const { latitude, longitude } = priority.establishment;

    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      continue;
    }

    const previous = visits.at(-1);

    visits.push({
      priority,
      latitude,
      longitude,
      legKm: previous ? haversineKm(previous, { latitude, longitude }) : null,
    });
  }

  return visits;
}

export function totalVisitKm(visits: PlottedVisit[]): number {
  return visits.reduce((sum, visit) => sum + (visit.legKm ?? 0), 0);
}
