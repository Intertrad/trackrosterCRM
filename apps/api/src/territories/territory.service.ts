import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaigns,
  campaignTerritories,
  territories,
  tenants,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ResourceScopeService } from '../resource-scopes/resource-scope.service.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import type { CreateTerritoryDto, UpdateTerritoryDto } from './territory.dto.js';
const columns = {
  ...getTableColumns(territories),
  boundary: sql<Record<string, unknown> | null>`ST_AsGeoJSON(${territories.boundary})::jsonb`,
  center: sql<Record<
    string,
    unknown
  > | null>`ST_AsGeoJSON(ST_PointOnSurface(${territories.boundary}))::jsonb`,
};
@Injectable()
export class TerritoryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scopes: ResourceScopeService,
  ) {}
  async list(auth: AuthenticatedPrincipal) {
    return this.db
      .select(columns)
      .from(territories)
      .where(this.scopes.predicate(auth, 'territory'))
      .orderBy(territories.name, territories.id);
  }
  async get(auth: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select(columns)
      .from(territories)
      .where(and(eq(territories.id, id), this.scopes.predicate(auth, 'territory')));
    if (!row) throw new NotFoundException('Territory not found');
    return row;
  }
  async map(auth: AuthenticatedPrincipal) {
    const rows = await this.list(auth);
    return {
      type: 'FeatureCollection',
      features: rows
        .filter((r) => r.status === 'active' && r.boundary)
        .map((r) => ({
          type: 'Feature',
          id: r.id,
          geometry: r.boundary,
          properties: { name: r.name, code: r.code, parentId: r.parentId, center: r.center },
        })),
    };
  }
  private async lock(auth: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('update');
  }
  private async boundary(value: Record<string, unknown> | null | undefined, tx: DatabaseExecutor) {
    if (value === undefined || value === null) return value;
    if (
      !['Polygon', 'MultiPolygon'].includes(String(value.type)) ||
      value.crs ||
      JSON.stringify(value).length > 200000
    )
      throw new BadRequestException(
        'Boundary must be a WGS84 Polygon or MultiPolygon, at most 200KB',
      );
    const encoded = JSON.stringify(value);
    const result = await tx.execute<{ valid: boolean }>(
      sql`SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_NDims(g) = 2 AND ST_CoveredBy(g, ST_MakeEnvelope(-180,-90,180,90,4326)) AS valid FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${encoded}),4326) g) parsed`,
    );
    if (!result.rows[0]?.valid) throw new BadRequestException('Invalid boundary geometry');
    return sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${encoded}),4326))`;
  }
  private async parent(
    auth: AuthenticatedPrincipal,
    id: string | null,
    parentId: string | null | undefined,
    tx: DatabaseExecutor,
  ) {
    if (!parentId) return;
    // A caller must be able to see the chosen parent; parentage never inherits access.
    await this.scopes.require(auth, 'territory', parentId, 'read', tx);
    const [parent] = await tx
      .select()
      .from(territories)
      .where(and(eq(territories.tenantId, auth.tenantId), eq(territories.id, parentId)));
    if (parent?.status !== 'active') throw new ConflictException('Parent territory must be active');
    if (id) {
      const result = await tx.execute<{ id: string }>(sql`WITH RECURSIVE ancestry AS (
        SELECT id, parent_id FROM territories WHERE tenant_id = ${auth.tenantId} AND id = ${parentId}
        UNION SELECT t.id, t.parent_id FROM territories t JOIN ancestry a ON t.id = a.parent_id WHERE t.tenant_id = ${auth.tenantId}
      ) SELECT id FROM ancestry WHERE id = ${id}`);
      if (result.rows.length)
        throw new ConflictException('Territory hierarchy cannot contain cycles');
    }
  }
  private async transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>) {
    try {
      return await this.db.transaction(run);
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      if (code === '23505')
        throw new ConflictException('Territory code or campaign link already exists');
      if (['XX000', '22023', '22P02', '23514'].includes(code ?? ''))
        throw new BadRequestException('Invalid territory geometry or metadata');
      throw error;
    }
  }
  async create(auth: AuthenticatedPrincipal, input: CreateTerritoryDto) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      await this.parent(auth, null, input.parentId, tx);
      const boundary = await this.boundary(input.boundary, tx);
      const [row] = await tx
        .insert(territories)
        .values({ ...input, boundary, tenantId: auth.tenantId })
        .returning({ id: territories.id });
      const after = await this.get(auth, row!.id, tx);
      await this.audit(auth, row!.id, 'territory.created', { after }, tx);
      return after;
    });
  }
  async update(
    auth: AuthenticatedPrincipal,
    id: string,
    input: UpdateTerritoryDto,
    ifMatch?: string,
  ) {
    if (!Object.values(input).some((v) => v !== undefined))
      throw new BadRequestException('At least one field is required');
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      await this.scopes.require(
        auth,
        'territory',
        id,
        input.status !== undefined || input.parentId !== undefined ? 'manage' : 'read_write',
        tx,
      );
      const before = await this.get(auth, id, tx);
      assertResourceMatches(ifMatch, before);
      await this.parent(
        auth,
        id,
        input.parentId === undefined && input.status === 'active'
          ? before.parentId
          : input.parentId,
        tx,
      );
      if (input.status === 'inactive') {
        const result =
          await tx.execute(sql`SELECT id FROM territories WHERE tenant_id = ${auth.tenantId} AND parent_id = ${id} AND status = 'active'
          UNION ALL SELECT campaign_id AS id FROM campaign_territories WHERE tenant_id = ${auth.tenantId} AND territory_id = ${id}
          UNION ALL SELECT id FROM territory_assignments WHERE tenant_id = ${auth.tenantId} AND territory_id = ${id} AND revoked_at IS NULL AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP) LIMIT 1`);
        if (result.rows.length)
          throw new ConflictException(
            'End territory responsibilities, deactivate children and remove campaign links before deactivating territory',
          );
      }
      const boundary = await this.boundary(input.boundary, tx);
      await tx
        .update(territories)
        .set({ ...input, boundary, updatedAt: sql`clock_timestamp()` })
        .where(and(eq(territories.tenantId, auth.tenantId), eq(territories.id, id)));
      // Read directly after deactivation: the successful mutation may revoke its own visibility.
      const [after] = await tx
        .select(columns)
        .from(territories)
        .where(and(eq(territories.tenantId, auth.tenantId), eq(territories.id, id)));
      await this.audit(auth, id, 'territory.updated', { before, after }, tx);
      return after;
    });
  }
  async campaignTerritories(auth: AuthenticatedPrincipal, campaignId: string) {
    await this.scopes.require(auth, 'campaign', campaignId);
    return this.db
      .select(columns)
      .from(territories)
      .innerJoin(
        campaignTerritories,
        and(
          eq(campaignTerritories.tenantId, territories.tenantId),
          eq(campaignTerritories.territoryId, territories.id),
        ),
      )
      .where(
        and(
          eq(campaignTerritories.campaignId, campaignId),
          this.scopes.predicate(auth, 'territory'),
        ),
      )
      .orderBy(territories.id);
  }
  async link(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    territoryId: string,
    remove = false,
  ) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      await this.scopes.require(auth, 'campaign', campaignId, 'manage', tx);
      await this.scopes.require(auth, 'territory', territoryId, 'read', tx);
      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, campaignId)))
        .for('share');
      const territory = await this.get(auth, territoryId, tx);
      if (!remove && (campaign?.status === 'archived' || territory.status !== 'active'))
        throw new ConflictException('Campaign and territory must be available');
      if (remove) {
        const rows = await tx
          .delete(campaignTerritories)
          .where(
            and(
              eq(campaignTerritories.tenantId, auth.tenantId),
              eq(campaignTerritories.campaignId, campaignId),
              eq(campaignTerritories.territoryId, territoryId),
            ),
          )
          .returning();
        if (!rows.length) throw new NotFoundException('Campaign territory link not found');
      } else
        await tx
          .insert(campaignTerritories)
          .values({ tenantId: auth.tenantId, campaignId, territoryId });
      await this.audit(
        auth,
        campaignId,
        remove ? 'campaign.territory_removed' : 'campaign.territory_added',
        { territoryId },
        tx,
        'campaign',
      );
      return { campaignId, territoryId };
    });
  }
  private async audit(
    auth: AuthenticatedPrincipal,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    tx: DatabaseExecutor,
    resourceType = 'territory',
  ) {
    await tx.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      action,
      resourceType,
      resourceId: id,
      metadata,
    });
  }
}
