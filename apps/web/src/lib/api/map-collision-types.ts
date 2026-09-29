export interface MapCollision {
  id: string;
  establishmentId: string;
  name: string;
  latitude: number;
  longitude: number;
  reservedAt: string;
  expiresAt: string;
  severity: 'warning';
}

export interface MapCollisionPage {
  items: MapCollision[];
  count: number;
  lookbackHours: number;
  bbox: [number, number, number, number];
}
