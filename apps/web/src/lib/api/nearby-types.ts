/** Upstream bounds on a nearby search. */
export const MAX_NEARBY_RADIUS_METERS = 50_000;

export const DEFAULT_NEARBY_RADIUS_METERS = 5_000;

export const MAX_NEARBY_LIMIT = 200;

export interface NearbyProspect {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Lifecycle stages this prospect holds across campaigns. */
  stages?: string[];
  distance: number;
}

export interface NearbyProspectPage {
  items: NearbyProspect[];
  nextCursor: string | null;
  radiusMeters: number;
}

export function formatDistanceMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
