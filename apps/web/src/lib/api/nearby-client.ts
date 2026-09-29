import { browserJson } from './browser-json';
import type { NearbyProspectPage } from './nearby-types';

export function listNearbyProspects(
  options: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    limit?: number;
    cursor?: string;
  },
  signal?: AbortSignal,
): Promise<NearbyProspectPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return browserJson<NearbyProspectPage>(`/api/prospects/nearby?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
}
