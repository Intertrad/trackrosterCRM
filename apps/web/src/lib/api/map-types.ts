import type { WorkQueueLifecycleStage } from './work-queue-types';

export interface MapViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

export interface MapFeatureProperties {
  cluster?: boolean;
  count?: number;
  establishmentId?: string;
  name?: string;
  stages?: WorkQueueLifecycleStage[];
}

export interface MapFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: MapFeatureProperties;
}

export interface MapProspectResponse {
  type: 'FeatureCollection';
  features: MapFeature[];
  bbox: [number, number, number, number];
  zoom: number;
  summary: {
    prospects: number;
    campaignMemberships: number;
    byLifecycleStage: Record<string, number>;
  };
  truncated: boolean;
  totalFeatures: number;
}
