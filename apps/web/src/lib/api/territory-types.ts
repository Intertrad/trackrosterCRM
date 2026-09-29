/** GET /territories */
export interface Territory {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  status: string;

  /** GeoJSON geometry, or null when no boundary has been drawn. */
  boundary: GeoJsonGeometry | null;
  center: GeoJsonGeometry | null;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface TerritoryFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJsonGeometry;
  properties: {
    name: string;
    code: string | null;
    parentId: string | null;
    center: GeoJsonGeometry | null;
  };
}

/** GET /territories/map — a GeoJSON FeatureCollection of authorised areas. */
export interface TerritoryFeatureCollection {
  type: 'FeatureCollection';
  features: TerritoryFeature[];
}

/**
 * A territory assigned to a person or a team for a period.
 *
 * Shares the participation model with campaign membership: the same states,
 * the same period semantics, and the same "person or team, never both" rule.
 */
export interface TerritoryAssignment {
  id: string;
  tenantId: string;
  territoryId: string;
  membershipId: string | null;
  teamId: string | null;
  priority: number | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  state: 'active' | 'scheduled' | 'ended' | 'revoked';
  etag?: string;
}

export interface TerritoryAssignmentPage {
  items: TerritoryAssignment[];
  nextCursor: string | null;
}

/** Upstream bound on the priority field. */
export const MAX_TERRITORY_PRIORITY = 100_000;
