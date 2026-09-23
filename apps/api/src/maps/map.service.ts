import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { resourceScopePredicate } from '../resource-scopes/resource-scope.service.js';
import type {
  HeatmapDto,
  MapAggregateDto,
  MapViewportDto,
  NearbyProspectsDto,
  ProspectMapFiltersDto,
} from './map.dto.js';
const MAX_MEMBERSHIPS = 20000;
export function viewport(value: string): number[] {
  const parts = value.split(',');
  if (parts.length !== 4 || parts.some((v) => !v.trim()))
    throw new BadRequestException('bbox must be west,south,east,north');
  const b = parts.map(Number);
  if (
    b.some((v) => !Number.isFinite(v)) ||
    Math.abs(b[0]!) > 180 ||
    Math.abs(b[2]!) > 180 ||
    b[1]! < -90 ||
    b[3]! > 90 ||
    b[1]! >= b[3]! ||
    b[0] === b[2]
  )
    throw new BadRequestException('Invalid WGS84 bounding box');
  return b;
}
export function activityWindow(q: { from?: string; to?: string }, now = new Date()) {
  const to = q.to ? new Date(q.to) : now;
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 86400000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to ||
    to.getTime() - from.getTime() > 366 * 86400000
  )
    throw new BadRequestException('Activity window must be increasing and at most 366 days');
  return { from: from.toISOString(), to: to.toISOString() };
}
@Injectable()
export class MapService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private spatial(b: number[], column: SQL = sql`e.location`) {
    const [w, s, e, n] = b;
    return w! < e!
      ? sql`${column} && ST_MakeEnvelope(${w},${s},${e},${n},4326)`
      : sql`(${column} && ST_MakeEnvelope(${w},${s},180,${n},4326) OR ${column} && ST_MakeEnvelope(-180,${s},${e},${n},4326))`;
  }
  private eligible(a: AuthenticatedPrincipal, q: ProspectMapFiltersDto, spatial: SQL) {
    // Match prospectReadScope authority using the already joined campaign/prospect.
    // Rejoining those tables inside the scope check can produce huge intermediate results.
    return sql`eligible AS MATERIALIZED (
    SELECT cp.id AS campaign_prospect_id,cp.campaign_id,cp.lifecycle_stage,e.id,e.name,e.longitude,e.latitude,e.location,
      EXISTS(SELECT 1 FROM campaign_prospect_assignments ca WHERE ca.tenant_id=cp.tenant_id AND ca.campaign_prospect_id=cp.id AND ca.ended_at IS NULL) AS assigned
    FROM establishments e JOIN campaign_prospects cp ON cp.tenant_id=e.tenant_id AND cp.establishment_id=e.id
    JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id
    WHERE e.tenant_id=${a.tenantId} AND e.status='active' AND e.location IS NOT NULL AND cp.status='active'
      AND ${spatial} AND EXISTS (
        SELECT 1 FROM user_access_grants g WHERE g.tenant_id=cp.tenant_id AND g.user_id=${a.membershipId} AND (
          (g.scope_type='tenant' AND g.role IN ('client_admin','observer')) OR
          (g.scope_type='organization' AND g.organization_id=c.organization_id AND g.role IN ('director','observer')) OR
          (g.scope_type='team' AND EXISTS (
            SELECT 1 FROM campaign_prospect_assignments aa
            WHERE aa.tenant_id=cp.tenant_id AND aa.campaign_prospect_id=cp.id AND aa.ended_at IS NULL
              AND aa.team_id=g.team_id AND (g.role IN ('manager','observer') OR
                (g.role='prospector' AND (aa.assigned_user_id IS NULL OR aa.assigned_user_id=${a.membershipId})))
          ))
        )
      )
      AND ${q.campaignStatus ? sql`c.status=${q.campaignStatus}` : sql`c.status IN ('active','paused')`}
      ${q.campaignId ? sql`AND cp.campaign_id=${q.campaignId}` : sql``}
      ${q.organizationId ? sql`AND c.organization_id=${q.organizationId}` : sql``}
      ${q.teamId ? sql`AND EXISTS(SELECT 1 FROM campaign_prospect_assignments ca WHERE ca.tenant_id=cp.tenant_id AND ca.campaign_prospect_id=cp.id AND ca.team_id=${q.teamId} AND ca.ended_at IS NULL)` : sql``}
      ${q.lifecycleStage ? sql`AND cp.lifecycle_stage=${q.lifecycleStage}` : sql``}
      ${q.search ? sql`AND e.name ILIKE ${'%' + q.search.replace(/[\\%_]/g, '\\$&') + '%'}` : sql``}
      ${q.territoryId ? sql`AND EXISTS(SELECT 1 FROM territories WHERE territories.id=${q.territoryId} AND ${resourceScopePredicate(a, 'territory')} AND territories.status='active' AND ST_Covers(territories.boundary,e.location))` : sql``}
    LIMIT ${MAX_MEMBERSHIPS + 1}
  ), points AS MATERIALIZED (
    SELECT id,name,longitude,latitude,location,array_agg(DISTINCT lifecycle_stage ORDER BY lifecycle_stage) AS stages,
      bool_or(assigned) AS assigned,bool_or(lifecycle_stage='converted') AS converted
    FROM eligible GROUP BY id,name,longitude,latitude,location
  )`;
  }
  private check(row: Record<string, unknown>) {
    if (Number(row.memberships) > MAX_MEMBERSHIPS)
      throw new PayloadTooLargeException({
        code: 'MAP_SCOPE_TOO_LARGE',
        message:
          'Narrow the viewport or filters; maps accept at most 20,000 visible campaign memberships',
      });
  }
  async markers(a: AuthenticatedPrincipal, q: MapViewportDto) {
    const bbox = viewport(q.bbox),
      size = 360 / 2 ** q.zoom;
    const result = await this.db
      .execute(sql`WITH ${this.eligible(a, q, this.spatial(bbox))}, cells AS (
    SELECT floor((longitude+180)/${size})::int AS x,floor((latitude+90)/${size})::int AS y,
      count(*)::int AS count,avg(longitude) AS longitude,avg(latitude) AS latitude,
      min(id::text) AS id,min(name) AS name
    FROM points GROUP BY x,y
  ) SELECT (SELECT count(*) FROM eligible)::int AS memberships,(SELECT count(*) FROM points)::int AS total,
    (SELECT count(*) FROM cells)::int AS cells,
    (SELECT coalesce(jsonb_object_agg(lifecycle_stage,n),'{}'::jsonb) FROM (SELECT lifecycle_stage,count(*)::int n FROM eligible GROUP BY lifecycle_stage) counts) AS stages,
    coalesce((SELECT jsonb_agg(jsonb_build_object('type','Feature','id',CASE WHEN count=1 THEN id ELSE ${String(q.zoom)}||':'||x||':'||y END,
      'geometry',jsonb_build_object('type','Point','coordinates',jsonb_build_array(longitude,latitude)),
      'properties',CASE WHEN count=1 THEN jsonb_build_object('cluster',false,'count',1,'establishmentId',id,'name',name,'stages',(SELECT stages FROM points WHERE points.id=c.id::uuid)) ELSE jsonb_build_object('cluster',true,'count',count) END) ORDER BY x,y)
      FROM (SELECT * FROM cells ORDER BY x,y LIMIT 1000) c),'[]'::jsonb) AS features`);
    const row = result.rows[0]!;
    this.check(row);
    return {
      type: 'FeatureCollection',
      features: row.features,
      bbox,
      zoom: q.zoom,
      summary: {
        prospects: row.total,
        campaignMemberships: row.memberships,
        byLifecycleStage: row.stages,
      },
      truncated: Number(row.cells) > 1000,
      totalFeatures: row.cells,
    };
  }
  async nearby(a: AuthenticatedPrincipal, q: NearbyProspectsDto) {
    const origin = sql`ST_SetSRID(ST_MakePoint(${q.longitude},${q.latitude}),4326)::geography`;
    const result = await this.db
      .execute(sql`WITH ${this.eligible(a, q, sql`ST_DWithin(e.location::geography,${origin},${q.radiusMeters})`)}, distances AS (
    SELECT id,name,longitude,latitude,stages,ST_Distance(location::geography,${origin}) AS distance FROM points
  ) SELECT (SELECT count(*) FROM eligible)::int AS memberships,
    ${q.cursor ? sql`EXISTS(SELECT 1 FROM distances WHERE id=${q.cursor})` : sql`true`} AS valid_cursor,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'establishmentId',id,'name',name,'longitude',longitude,'latitude',latitude,'stages',stages,'distanceMeters',distance) ORDER BY distance,id)
      FROM (SELECT * FROM distances ${q.cursor ? sql`WHERE (distance,id)>(SELECT distance,id FROM distances WHERE id=${q.cursor})` : sql``} ORDER BY distance,id LIMIT ${q.limit + 1}) page),'[]'::jsonb) AS items`);
    const row = result.rows[0]!;
    this.check(row);
    if (!row.valid_cursor)
      throw new BadRequestException('Cursor is outside the authorized nearby result');
    const items = row.items as { id: string }[];
    return {
      items: items.slice(0, q.limit),
      nextCursor: items.length > q.limit ? items[q.limit - 1]!.id : null,
      radiusMeters: q.radiusMeters,
    };
  }
  private measures(a: AuthenticatedPrincipal, q: MapAggregateDto) {
    const window = activityWindow(q);
    return {
      window,
      cte: sql`measures AS MATERIALIZED (
    SELECT p.*,coalesce(m.activities,0)::int AS activities,coalesce(m.contacted,false) AS contacted FROM points p LEFT JOIN (
      SELECT e.id,count(*)::int AS activities,bool_or(ac.type IN ('call','email','message','visit')) AS contacted
      FROM eligible e JOIN actions ac ON ac.tenant_id=${a.tenantId} AND ac.campaign_prospect_id=e.campaign_prospect_id
      WHERE ac.status='completed' AND ac.completed_at>=${window.from}::timestamptz AND ac.completed_at<${window.to}::timestamptz GROUP BY e.id
    ) m ON m.id=p.id
  )`,
    };
  }
  async heatmap(a: AuthenticatedPrincipal, q: HeatmapDto) {
    const bbox = viewport(q.bbox),
      size = 360 / 2 ** q.zoom,
      { window, cte } = this.measures(a, q);
    const result = await this.db
      .execute(sql`WITH ${this.eligible(a, q, this.spatial(bbox))},${cte}, cells AS (
    SELECT floor((longitude+180)/${size})::int AS x,floor((latitude+90)/${size})::int AS y,avg(longitude) longitude,avg(latitude) latitude,
      count(*)::int prospects,sum(activities)::int activities,count(*) FILTER(WHERE converted)::int converted FROM measures GROUP BY x,y
  ) SELECT (SELECT count(*) FROM eligible)::int memberships,(SELECT count(*) FROM cells)::int cells,
    coalesce((SELECT jsonb_agg(jsonb_build_object('type','Feature','id',${String(q.zoom)}||':'||x||':'||y,'geometry',jsonb_build_object('type','Point','coordinates',jsonb_build_array(longitude,latitude)),
      'properties',jsonb_build_object('prospects',prospects,'completedActions',activities,'convertedProspects',converted,'weight',${q.metric === 'activity' ? sql`activities` : sql`converted`})) ORDER BY x,y) FROM (SELECT * FROM cells ORDER BY x,y LIMIT 1000) c),'[]'::jsonb) features`);
    const row = result.rows[0]!;
    this.check(row);
    return {
      type: 'FeatureCollection',
      features: row.features,
      bbox,
      zoom: q.zoom,
      metric: q.metric,
      activityWindow: window,
      conversionBasis: 'current_lifecycle',
      truncated: Number(row.cells) > 1000,
      totalFeatures: row.cells,
    };
  }
  async coverage(a: AuthenticatedPrincipal, q: MapAggregateDto) {
    const bbox = viewport(q.bbox),
      { window, cte } = this.measures(a, q);
    const result = await this.db
      .execute(sql`WITH ${this.eligible(a, q, this.spatial(bbox))},${cte}, areas AS MATERIALIZED (
    SELECT territories.id,territories.name,territories.boundary FROM territories WHERE ${resourceScopePredicate(a, 'territory')}
      AND territories.status='active' AND territories.boundary IS NOT NULL AND ${this.spatial(bbox, sql`territories.boundary`)}
      ${q.territoryId ? sql`AND territories.id=${q.territoryId}` : sql``}
      ORDER BY territories.id LIMIT 201
  ), counts AS (
    SELECT ar.id,ar.name,ST_AsGeoJSON(ar.boundary)::jsonb geometry,count(m.id)::int prospects,
      count(m.id) FILTER(WHERE m.assigned)::int assigned,count(m.id) FILTER(WHERE m.contacted)::int contacted,count(m.id) FILTER(WHERE m.converted)::int converted
    FROM areas ar LEFT JOIN measures m ON ST_Covers(ar.boundary,m.location) GROUP BY ar.id,ar.name,ar.boundary
  ) SELECT (SELECT count(*) FROM eligible)::int memberships,(SELECT count(*) FROM areas)::int areas,
    coalesce((SELECT jsonb_agg(jsonb_build_object('type','Feature','id',id,'geometry',geometry,'properties',jsonb_build_object('name',name,'prospects',prospects,'assignedProspects',assigned,'contactedProspects',contacted,'convertedProspects',converted,'coveragePercent',CASE WHEN prospects=0 THEN 0 ELSE round(100.0*contacted/prospects,2) END)) ORDER BY id) FROM counts),'[]'::jsonb) features`);
    const row = result.rows[0]!;
    this.check(row);
    if (Number(row.areas) > 200)
      throw new PayloadTooLargeException(
        'Narrow the viewport to at most 200 authorized territories',
      );
    return {
      type: 'FeatureCollection',
      features: row.features,
      bbox,
      activityWindow: window,
      coverageBasis: 'completed_contact_actions_over_visible_prospects',
      overlappingTerritories: 'counted_independently',
    };
  }
}
