import { browserJson } from './browser-json';
import type { MapProspectResponse, MapViewport } from './map-types';
import type { WorkQueueLifecycleStage } from './work-queue-types';

export interface MapProspectQuery extends MapViewport {
  search?: string;
  lifecycleStage?: WorkQueueLifecycleStage;
  campaignId?: string;
  organizationId?: string;
  teamId?: string;
  territoryId?: string;
}

export function listMapProspects(
  query: MapProspectQuery,
  signal?: AbortSignal,
): Promise<MapProspectResponse> {
  const params = new URLSearchParams({
    bbox: `${query.west},${query.south},${query.east},${query.north}`,
    zoom: String(Math.round(query.zoom)),
  });

  for (const key of [
    'search',
    'lifecycleStage',
    'campaignId',
    'organizationId',
    'teamId',
    'territoryId',
  ] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }

  return browserJson<MapProspectResponse>(`/api/prospects/map?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
}
