import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedPrincipal as Actor } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  fieldRoutes as r,
  routeStops as s,
  tenants,
  auditEvents,
} from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import type {
  AddStopDto,
  CreateRouteDto,
  RouteListDto,
  StopOrderDto,
  UpdateRouteDto,
  UpdateStopDto,
} from './route.dto.js';
import { optimizeStops, routeDistance } from './route-geometry.js';
@Injectable()
export class RouteService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private scope(a: Actor, write = false): SQL {
    return sql`EXISTS(SELECT 1 FROM teams t JOIN user_access_grants g ON g.tenant_id=t.tenant_id AND g.user_id=${a.membershipId} JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE t.tenant_id=${a.tenantId} AND t.id=${r.teamId} AND m.status='active' AND i.status='active' AND (${write ? sql`${r.ownerId}=${a.membershipId} AND t.status='active' AND g.role='prospector' AND g.scope_type='team' AND g.team_id=t.id` : sql`(g.scope_type='tenant' AND g.role IN ('client_admin','observer')) OR (g.scope_type='organization' AND g.organization_id=t.organization_id AND g.role IN ('director','observer')) OR (g.scope_type='team' AND g.team_id=t.id AND (g.role IN ('manager','observer') OR (g.role='prospector' AND ${r.ownerId}=${a.membershipId})))`}))`;
  }
  async row(a: Actor, id: string, write = false, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select()
      .from(r)
      .where(and(eq(r.tenantId, a.tenantId), eq(r.id, id), this.scope(a, write)));
    if (!row) throw new NotFoundException('Route not found');
    return row;
  }
  async stops(a: Actor, id: string, tx: DatabaseExecutor = this.db) {
    return tx
      .select()
      .from(s)
      .where(and(eq(s.tenantId, a.tenantId), eq(s.routeId, id)))
      .orderBy(s.position, s.id);
  }
  private public(row: typeof r.$inferSelect, stops: (typeof s.$inferSelect)[]) {
    const distance = routeDistance(row.startPoint, stops, row.endPoint);
    return {
      ...row,
      etag: resourceETag(row),
      stops,
      metrics: {
        stopCount: stops.length,
        completedStops: stops.filter((s) => s.status === 'completed').length,
        skippedStops: stops.filter((s) => s.status === 'skipped').length,
        distanceKm: distance,
        estimatedTravelMinutes: Math.ceil((distance / 30) * 60),
        distanceBasis: 'great_circle',
        durationBasis:
          '30 km/h geographic estimate; excludes traffic, road network and stop duration',
      },
    };
  }
  async detail(a: Actor, id: string) {
    const row = await this.row(a, id);
    return this.public(row, await this.stops(a, id));
  }
  async list(a: Actor, q: RouteListDto) {
    const rows = await this.db
      .select()
      .from(r)
      .where(
        and(
          eq(r.tenantId, a.tenantId),
          this.scope(a),
          q.teamId ? eq(r.teamId, q.teamId) : undefined,
          q.status ? eq(r.status, q.status) : undefined,
          q.cursor ? gt(r.id, q.cursor) : undefined,
        ),
      )
      .orderBy(r.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((row) => ({ ...row, etag: resourceETag(row) })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async authorizeCreate(a: Actor, teamId: string, tx: DatabaseExecutor = this.db) {
    const result = await tx.execute(
      sql`SELECT 1 FROM teams t JOIN user_access_grants g ON g.tenant_id=t.tenant_id AND g.team_id=t.id JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE t.tenant_id=${a.tenantId} AND t.id=${teamId} AND t.status='active' AND g.user_id=${a.membershipId} AND g.role='prospector' AND g.scope_type='team' AND m.status='active' AND i.status='active'`,
    );
    if (!result.rows.length) throw new NotFoundException('Eligible route team not found');
  }
  private async lock(a: Actor, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
  }
  private async audit(
    a: Actor,
    id: string,
    op: string,
    data: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(auditEvents).values({
      tenantId: a.tenantId,
      actorType: 'user',
      actorUserId: a.membershipId,
      resourceType: 'route',
      resourceId: id,
      action: `route.${op}`,
      metadata: data,
    });
  }
  async create(a: Actor, b: CreateRouteDto) {
    if (!b.name || !b.scheduledAt || !b.startPoint)
      throw new BadRequestException('Name, schedule and start point are required');
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      await this.authorizeCreate(a, b.teamId, tx);
      const [row] = await tx
        .insert(r)
        .values({
          tenantId: a.tenantId,
          ownerId: a.membershipId,
          teamId: b.teamId,
          name: b.name.trim(),
          scheduledAt: new Date(b.scheduledAt),
          startPoint: b.startPoint,
          endPoint: b.endPoint ?? null,
        })
        .returning();
      await this.audit(a, row!.id, 'created', { after: row }, tx);
      return this.public(row!, []);
    });
  }
  private async eligible(
    a: Actor,
    route: typeof r.$inferSelect,
    prospectId: string,
    actionId: string | null,
    tx: DatabaseExecutor,
    completing = false,
  ) {
    const result = await tx.execute<{
      latitude: number;
      longitude: number;
      establishmentId: string;
      assignmentId: string;
    }>(
      sql`SELECT e.latitude,e.longitude,e.id AS "establishmentId",ca.id AS "assignmentId" FROM campaign_prospects cp JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id JOIN campaign_prospect_assignments ca ON ca.tenant_id=cp.tenant_id AND ca.campaign_prospect_id=cp.id AND ca.ended_at IS NULL WHERE cp.tenant_id=${a.tenantId} AND cp.id=${prospectId} AND ca.team_id=${route.teamId} AND (ca.assigned_user_id IS NULL OR ca.assigned_user_id=${route.ownerId}) AND ca.status='active' AND c.status='active' AND e.status='active' AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND (${completing} OR NOT trackroster_consent_blocked(cp.tenant_id,e.id,'visit'))`,
    );
    if (!result.rows.length)
      throw new ConflictException(
        'Stop requires an eligible assigned prospect with coordinates and visit consent',
      );
    if (actionId) {
      const action = await tx.execute(
        sql`SELECT 1 FROM actions WHERE tenant_id=${a.tenantId} AND id=${actionId} AND campaign_prospect_id=${prospectId} AND assignee_membership_id=${route.ownerId} AND assignment_id=${result.rows[0]!.assignmentId} AND type='visit' AND ${completing ? sql`status='completed'` : sql`status IN ('planned','started')`}`,
      );
      if (!action.rows.length) throw new ConflictException('Linked visit action is unavailable');
    }
    const point = result.rows[0]!;
    return { latitude: point.latitude, longitude: point.longitude };
  }
  async stopRoute(a: Actor, id: string, write = true) {
    const [stop] = await this.db
      .select()
      .from(s)
      .where(and(eq(s.tenantId, a.tenantId), eq(s.id, id)));
    if (!stop) throw new NotFoundException('Stop not found');
    await this.row(a, stop.routeId, write);
    return stop.routeId;
  }
  async mutate(
    a: Actor,
    id: string,
    op:
      'update' | 'cancel' | 'add' | 'stop' | 'remove' | 'order' | 'optimize' | 'start' | 'complete',
    input: UpdateRouteDto | AddStopDto | UpdateStopDto | StopOrderDto,
    version?: string,
    stopId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const row = await this.row(a, id, true, tx);
      assertResourceMatches(version, row);
      let stops = await this.stops(a, id, tx);
      const changes: Omit<Partial<typeof r.$inferInsert>, 'updatedAt'> & { updatedAt: SQL } = {
        updatedAt: sql`GREATEST(clock_timestamp(), ${r.updatedAt} + interval '1 millisecond')`,
      };
      if (['completed', 'cancelled'].includes(row.status))
        throw new ConflictException('Route is finalized');
      if (
        ['update', 'cancel', 'add', 'remove', 'order', 'optimize'].includes(op) &&
        row.status !== 'draft'
      )
        throw new ConflictException('Only draft routes can be planned or cancelled');
      if (op === 'update') {
        const b = input as UpdateRouteDto;
        if (!Object.keys(b).length) throw new BadRequestException('Supply a route change');
        if (b.name !== undefined) changes.name = b.name.trim();
        if (b.scheduledAt !== undefined) changes.scheduledAt = new Date(b.scheduledAt);
        if (b.startPoint !== undefined) changes.startPoint = b.startPoint;
        if (b.endPoint !== undefined) changes.endPoint = b.endPoint;
      }
      if (op === 'cancel') changes.status = 'cancelled';
      if (op === 'add') {
        const b = input as AddStopDto;
        if (stops.length >= 100) throw new ConflictException('Route supports at most 100 stops');
        if (stops.some((s) => s.campaignProspectId === b.campaignProspectId))
          throw new ConflictException('Prospect is already a stop');
        const point = await this.eligible(a, row, b.campaignProspectId, b.actionId ?? null, tx);
        await tx.insert(s).values({
          tenantId: a.tenantId,
          routeId: id,
          campaignProspectId: b.campaignProspectId,
          actionId: b.actionId ?? null,
          point,
          position: stops.length + 1,
        });
      }
      if (op === 'remove') {
        if (!stops.some((s) => s.id === stopId)) throw new NotFoundException('Stop not found');
        await tx.delete(s).where(and(eq(s.tenantId, a.tenantId), eq(s.id, stopId!)));
        stops = stops.filter((s) => s.id !== stopId);
        await this.reorder(a, stops, tx);
      }
      if (op === 'order' || op === 'optimize') {
        if (!stops.length) throw new ConflictException('Add route stops first');
        if (op === 'order') {
          const ids = (input as StopOrderDto).stopIds;
          if (ids.length !== stops.length || ids.some((id) => !stops.some((s) => s.id === id)))
            throw new BadRequestException('Provide every stop exactly once');
          stops = ids.map((id) => stops.find((s) => s.id === id)!);
        } else {
          for (const stop of stops)
            stop.point = await this.eligible(a, row, stop.campaignProspectId, stop.actionId, tx);
          stops = optimizeStops(row.startPoint, stops, row.endPoint);
        }
        await this.reorder(a, stops, tx);
      }
      if (op === 'start') {
        if (row.status !== 'draft' || !stops.length)
          throw new ConflictException('Start a nonempty draft route');
        const active = await tx
          .select({ id: r.id })
          .from(r)
          .where(
            and(eq(r.tenantId, a.tenantId), eq(r.ownerId, a.membershipId), eq(r.status, 'active')),
          );
        if (active.length) throw new ConflictException('Complete the active route first');
        for (const stop of stops) {
          stop.point = await this.eligible(a, row, stop.campaignProspectId, stop.actionId, tx);
          await tx.update(s).set({ point: stop.point }).where(eq(s.id, stop.id));
        }
        changes.status = 'active';
        changes.startedAt = new Date();
      }
      if (op === 'stop') {
        const stop = stops.find((s) => s.id === stopId);
        if (!stop) throw new NotFoundException('Stop not found');
        const b = input as UpdateStopDto;
        if (!Object.keys(b).length) throw new BadRequestException('Supply a stop change');
        if (b.position !== undefined) {
          if (row.status !== 'draft' || b.position > stops.length)
            throw new ConflictException('Reorder within draft route bounds');
          stops = stops.filter((s) => s.id !== stop.id);
          stops.splice(b.position - 1, 0, stop);
          await this.reorder(a, stops, tx);
        }
        const values: Partial<typeof s.$inferInsert> = { updatedAt: new Date() };
        if (b.eta !== undefined) {
          if (row.status !== 'draft')
            throw new ConflictException('ETA can be edited only in draft');
          values.eta = b.eta ? new Date(b.eta) : null;
        }
        if (b.status !== undefined || b.outcome !== undefined) {
          if (row.status !== 'active')
            throw new ConflictException('Start route before executing stops');
          if (['completed', 'skipped'].includes(stop.status))
            throw new ConflictException('Stop is finalized');
          const current = stops.find((s) => !['completed', 'skipped'].includes(s.status));
          if (current?.id !== stop.id)
            throw new ConflictException('Execute the next unfinished stop');
          if (!b.status) throw new BadRequestException('Provide stop status with outcome');
          if (b.status === 'arrived') {
            if (stop.status !== 'pending') throw new ConflictException('Stop already arrived');
            await this.eligible(a, row, stop.campaignProspectId, stop.actionId, tx);
            values.arrivedAt = new Date();
          } else {
            if (!b.outcome?.trim())
              throw new BadRequestException('An outcome or skip reason is required');
            if (b.status === 'completed') {
              if (stop.status !== 'arrived')
                throw new ConflictException('Arrive before completing');
              await this.eligible(a, row, stop.campaignProspectId, stop.actionId, tx, true);
              if (stop.actionId) {
                const completed = await tx.execute(
                  sql`SELECT 1 FROM actions WHERE tenant_id=${a.tenantId} AND id=${stop.actionId} AND status='completed'`,
                );
                if (!completed.rows.length)
                  throw new ConflictException('Complete the linked visit action first');
              }
            }
          }
          values.status = b.status;
          values.outcome = b.outcome ?? null;
        }
        await tx
          .update(s)
          .set(values)
          .where(and(eq(s.tenantId, a.tenantId), eq(s.id, stop.id)));
      }
      if (['update', 'add', 'remove'].includes(op))
        await tx
          .update(s)
          .set({ eta: null })
          .where(and(eq(s.tenantId, a.tenantId), eq(s.routeId, id)));
      if (op === 'complete') {
        if (
          row.status !== 'active' ||
          stops.some((s) => !['completed', 'skipped'].includes(s.status))
        )
          throw new ConflictException('Finish or skip all stops before completing an active route');
        changes.status = 'completed';
        changes.completedAt = new Date();
      }
      const [next] = await tx.update(r).set(changes).where(eq(r.id, id)).returning();
      await this.audit(a, id, op, { input, stopId: stopId ?? null, status: next!.status }, tx);
      return this.public(next!, await this.stops(a, id, tx));
    });
  }
  private async reorder(a: Actor, stops: (typeof s.$inferSelect)[], tx: DatabaseExecutor) {
    for (const [i, stop] of stops.entries())
      await tx
        .update(s)
        .set({ position: i + 1, point: stop.point, eta: null, updatedAt: new Date() })
        .where(and(eq(s.tenantId, a.tenantId), eq(s.id, stop.id)));
  }
  async todaySummary(a: Actor, teamId: string, from: string, to: string) {
    const rows = await this.db
      .select()
      .from(r)
      .where(
        and(
          eq(r.tenantId, a.tenantId),
          eq(r.teamId, teamId),
          eq(r.ownerId, a.membershipId),
          this.scope(a),
          sql`${r.scheduledAt}>=${from}::timestamptz AND ${r.scheduledAt}<${to}::timestamptz`,
          sql`${r.status}<>'cancelled'`,
        ),
      )
      .orderBy(r.scheduledAt, r.id)
      .limit(101);
    const items = [];
    for (const row of rows.slice(0, 100)) {
      const detail = this.public(row, await this.stops(a, row.id));
      items.push({
        ...detail,
        currentStop: detail.stops.find((s) => !['completed', 'skipped'].includes(s.status)) ?? null,
      });
    }
    return { available: true, items, truncated: rows.length > 100 };
  }
}
