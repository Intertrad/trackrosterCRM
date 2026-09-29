export type RouteStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type RouteStopStatus = 'arrived' | 'completed' | 'skipped';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  id: string;
  campaignProspectId: string;
  actionId: string | null;
  position: number;
  eta: string | null;
  status: RouteStopStatus | null;
  outcome: string | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
}

export interface FieldRoute {
  id: string;
  teamId: string;
  name: string;
  status: RouteStatus;
  scheduledAt: string;
  startPoint: RoutePoint;
  endPoint: RoutePoint | null;
  stops?: RouteStop[];
  totalDistanceMeters?: number | null;
  totalDurationSeconds?: number | null;
}

export interface RoutePage {
  items: FieldRoute[];
  nextCursor: string | null;
}

export interface CreateRouteInput {
  teamId: string;
  name: string;

  /** Must carry an explicit offset or Z; a bare local time is rejected. */
  scheduledAt: string;
  startPoint: RoutePoint;
  endPoint?: RoutePoint | null;
}

export interface ListRoutesQuery {
  teamId?: string;
  status?: RouteStatus;
  cursor?: string;
  limit?: number;
}

/** Upstream caps a round at 100 stops. */
export const MAX_ROUTE_STOPS = 100;

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) {
    return '—';
  }

  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return '—';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
