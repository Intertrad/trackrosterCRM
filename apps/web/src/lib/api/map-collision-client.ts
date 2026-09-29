import { browserJson } from './browser-json';
import type { MapCollisionPage } from './map-collision-types';
import type { MapViewport } from './map-types';

export function listMapCollisions(
  query: MapViewport & { teamId?: string },
  signal?: AbortSignal,
): Promise<MapCollisionPage> {
  const params = new URLSearchParams({
    bbox: `${query.west},${query.south},${query.east},${query.north}`,
    zoom: String(Math.round(query.zoom)),
  });
  if (query.teamId) params.set('teamId', query.teamId);

  return browserJson<MapCollisionPage>(`/api/map/collisions?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
}
