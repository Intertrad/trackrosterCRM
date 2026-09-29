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
  objectives as o,
  objectiveHistory,
  tenants,
  auditEvents,
} from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import type { CreateObjectiveDto, ObjectiveListDto, UpdateObjectiveDto } from './objective.dto.js';
import { objectiveRisk } from './objective-risk.js';
@Injectable()
export class ObjectiveService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private scope(a: Actor, write = false): SQL {
    return sql`EXISTS(SELECT 1 FROM user_access_grants g JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND m.status='active' AND i.status='active' AND ((g.role='client_admin' AND g.scope_type='tenant') OR (g.role='manager' AND g.scope_type='team' AND g.team_id=${o.teamId} AND g.organization_id=${o.organizationId}) ${write ? sql`` : sql`OR (g.role IN ('director','observer') AND g.scope_type='organization' AND g.organization_id=${o.organizationId}) OR (g.role='observer' AND g.scope_type='tenant') OR (g.role='observer' AND g.scope_type='team' AND g.team_id=${o.teamId})`}))`;
  }
  async row(a: Actor, id: string, write = false, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select()
      .from(o)
      .where(and(eq(o.tenantId, a.tenantId), eq(o.id, id), this.scope(a, write)));
    if (!row) throw new NotFoundException('Objective not found');
    return row;
  }
  async authorizeCreate(
    a: Actor,
    b: Pick<CreateObjectiveDto, 'organizationId' | 'teamId'>,
    tx: DatabaseExecutor = this.db,
  ) {
    const result = await tx.execute(
      sql`SELECT 1 FROM user_access_grants g JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND m.status='active' AND i.status='active' AND ((g.role='client_admin' AND g.scope_type='tenant') OR (g.role='manager' AND g.scope_type='team' AND g.organization_id=${b.organizationId} AND g.team_id=${b.teamId ?? null}))`,
    );
    if (!result.rows.length) throw new NotFoundException('Editable objective scope not found');
  }
  private contributions(now: Date): SQL {
    const common = sql`ca.tenant_id=${o.tenantId} AND ca.organization_id=${o.organizationId} AND (${o.teamId} IS NULL OR ca.team_id=${o.teamId})`;
    return sql`SELECT CASE WHEN ${o.metric} IN ('qualified_prospects','converted_prospects') THEN ac.establishment_id ELSE ac.id END AS key,ac.completed_at AS occurred_at FROM actions ac JOIN campaign_prospect_assignments ca ON ca.tenant_id=ac.tenant_id AND ca.id=ac.assignment_id WHERE ${common} AND ac.tenant_id=${o.tenantId} AND (${o.campaignId} IS NULL OR ac.campaign_id=${o.campaignId}) AND ac.status='completed' AND ac.completed_at>=${o.startsAt} AND ac.completed_at<${o.endsAt} AND ac.completed_at<=${now.toISOString()}::timestamptz AND (
  ${o.metric}='completed_actions' OR (${o.metric}='completed_visits' AND ac.type='visit') OR (${o.metric} IN ('qualified_prospects','converted_prospects') AND EXISTS(SELECT 1 FROM action_outcomes ao LEFT JOIN action_events ae ON ae.tenant_id=ao.tenant_id AND ae.action_id=ao.action_id AND ae.event_type='complete' WHERE ao.tenant_id=ac.tenant_id AND ao.action_id=ac.id AND COALESCE(ae.data->'outcomeDefinition'->>'behavior',ao.outcome_code)=CASE WHEN ${o.metric}='qualified_prospects' THEN 'qualified' ELSE 'converted' END)))
  UNION ALL SELECT f.id AS key,f.completed_at AS occurred_at FROM prospect_follow_ups f JOIN campaign_prospect_assignments ca ON ca.tenant_id=f.tenant_id AND ca.id=f.assignment_id WHERE ${common} AND ${o.metric}='completed_follow_ups' AND f.tenant_id=${o.tenantId} AND (${o.campaignId} IS NULL OR f.campaign_id=${o.campaignId}) AND f.status='completed' AND f.completed_at>=${o.startsAt} AND f.completed_at<${o.endsAt} AND f.completed_at<=${now.toISOString()}::timestamptz`;
  }
  private actual(now: Date) {
    return sql<number>`(SELECT count(DISTINCT contribution.key)::int FROM (${this.contributions(now)}) contribution)`;
  }
  private filters(a: Actor, q: ObjectiveListDto) {
    return and(
      eq(o.tenantId, a.tenantId),
      this.scope(a),
      q.organizationId ? eq(o.organizationId, q.organizationId) : undefined,
      q.teamId ? eq(o.teamId, q.teamId) : undefined,
      q.campaignId ? eq(o.campaignId, q.campaignId) : undefined,
      q.ownerId ? eq(o.ownerId, q.ownerId) : undefined,
    );
  }
  async list(a: Actor, q: ObjectiveListDto) {
    const now = new Date();
    const rows = await this.db
      .select({ definition: o, actual: this.actual(now) })
      .from(o)
      .where(and(this.filters(a, q), q.cursor ? gt(o.id, q.cursor) : undefined))
      .orderBy(o.id)
      .limit(q.limit + 1);
    return {
      generatedAt: now.toISOString(),
      items: rows.slice(0, q.limit).map((r) => this.public(r.definition, r.actual, now)),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.definition.id : null,
    };
  }
  private public(row: typeof o.$inferSelect, actual: number, now: Date) {
    return {
      ...row,
      etag: resourceETag(row),
      progress: objectiveRisk(row.target, Number(actual), row.startsAt, row.endsAt, now),
    };
  }
  async atRisk(a: Actor, q: ObjectiveListDto, period?: { from: string; to: string }) {
    const now = new Date(),
      actual = this.actual(now);
    const rank = sql<number>`CASE WHEN ${actual}>=${o.target} OR ${o.startsAt}>${now.toISOString()}::timestamptz THEN 0 WHEN ${o.endsAt}<=${now.toISOString()}::timestamptz THEN 3 WHEN ${actual}<0.8*${o.target}*extract(epoch FROM (${now.toISOString()}::timestamptz-${o.startsAt}))/extract(epoch FROM (${o.endsAt}-${o.startsAt})) THEN 2 WHEN ${actual}<${o.target}*extract(epoch FROM (${now.toISOString()}::timestamptz-${o.startsAt}))/extract(epoch FROM (${o.endsAt}-${o.startsAt})) THEN 1 ELSE 0 END`;
    const rows = await this.db
      .select({ definition: o, actual, total: sql<number>`count(*) over()::int` })
      .from(o)
      .where(
        and(
          this.filters(a, q),
          sql`${rank}>0`,
          period
            ? sql`${o.startsAt}<${period.to}::timestamptz AND ${o.endsAt}>${period.from}::timestamptz`
            : undefined,
        ),
      )
      .orderBy(sql`${rank} DESC`, o.endsAt, o.id)
      .limit(q.limit + 1);
    return {
      available: true,
      generatedAt: now.toISOString(),
      total: rows[0]?.total ?? 0,
      items: rows.slice(0, q.limit).map((r) => this.public(r.definition, r.actual, now)),
      truncated: rows.length > q.limit,
    };
  }
  async detail(a: Actor, id: string) {
    const row = await this.row(a, id);
    const now = new Date();
    const [measure] = await this.db
      .select({ actual: this.actual(now) })
      .from(o)
      .where(and(eq(o.tenantId, a.tenantId), eq(o.id, id), this.scope(a)));
    if (!measure) throw new NotFoundException('Objective not found');
    const history = await this.db
      .select()
      .from(objectiveHistory)
      .where(and(eq(objectiveHistory.tenantId, a.tenantId), eq(objectiveHistory.objectiveId, id)))
      .orderBy(sql`${objectiveHistory.createdAt} DESC`, objectiveHistory.id)
      .limit(50);
    const daily = await this.db.execute<{ date: string; count: number }>(
      sql`SELECT day::text AS date,count(*)::int AS count FROM ${o} CROSS JOIN LATERAL (SELECT (min(occurred_at) AT TIME ZONE 'UTC')::date AS day FROM (${this.contributions(now)}) c GROUP BY c.key) contributions WHERE ${o.tenantId}=${a.tenantId} AND ${o.id}=${id} GROUP BY day ORDER BY day`,
    );
    let cumulative = 0;
    return {
      ...this.public(row, measure.actual, now),
      history,
      progressHistory: daily.rows.map((day) => ({ ...day, cumulative: (cumulative += day.count) })),
      contributingMetrics: {
        metric: row.metric,
        period: '[startsAt, endsAt), capped at generation time',
        deduplication: row.metric.endsWith('_prospects')
          ? 'Distinct canonical establishments per objective period'
          : 'Distinct completed records',
        historyTimeZone: 'UTC',
      },
    };
  }
  private period(start: Date, end: Date) {
    if (!(end > start) || end.getTime() - start.getTime() > 366 * 86400000)
      throw new BadRequestException('Objective period must be positive and at most 366 days');
  }
  private async lock(a: Actor, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
  }
  private async record(
    a: Actor,
    row: typeof o.$inferSelect,
    operation: string,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(objectiveHistory).values({
      tenantId: a.tenantId,
      objectiveId: row.id,
      actorId: a.membershipId,
      definition: JSON.parse(JSON.stringify(row)) as Record<string, unknown>,
    });
    await tx.insert(auditEvents).values({
      tenantId: a.tenantId,
      actorType: 'user',
      actorUserId: a.membershipId,
      resourceType: 'objective',
      resourceId: row.id,
      action: `objective.${operation}`,
      metadata: { definition: row },
    });
  }
  async create(a: Actor, b: CreateObjectiveDto) {
    const startsAt = new Date(b.startsAt),
      endsAt = new Date(b.endsAt);
    this.period(startsAt, endsAt);
    if (endsAt <= new Date())
      throw new BadRequestException('New objectives must end in the future');
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      await this.authorizeCreate(a, b, tx);
      const scope = await tx.execute(
        sql`SELECT 1 FROM organizations org JOIN tenant_memberships m ON m.tenant_id=org.tenant_id AND m.id=${b.ownerId ?? a.membershipId} JOIN identities i ON i.id=m.identity_id WHERE org.tenant_id=${a.tenantId} AND org.id=${b.organizationId} AND org.status='active' AND m.status='active' AND i.status='active' AND EXISTS(SELECT 1 FROM user_access_grants og WHERE og.tenant_id=org.tenant_id AND og.user_id=m.id AND ((og.role='client_admin' AND og.scope_type='tenant') OR (og.scope_type='organization' AND og.organization_id=org.id) OR (og.scope_type='team' AND og.organization_id=org.id AND (${b.teamId ?? null}::uuid IS NULL OR og.team_id=${b.teamId ?? null})))) ${b.teamId ? sql`AND EXISTS(SELECT 1 FROM teams t WHERE t.tenant_id=org.tenant_id AND t.organization_id=org.id AND t.id=${b.teamId} AND t.status='active')` : sql``} ${b.campaignId ? sql`AND EXISTS(SELECT 1 FROM campaigns c WHERE c.tenant_id=org.tenant_id AND c.organization_id=org.id AND c.id=${b.campaignId} AND c.status<>'archived')` : sql``}`,
      );
      if (!scope.rows.length) throw new NotFoundException('Objective scope or owner unavailable');
      const [row] = await tx
        .insert(o)
        .values({
          tenantId: a.tenantId,
          organizationId: b.organizationId,
          teamId: b.teamId ?? null,
          campaignId: b.campaignId ?? null,
          ownerId: b.ownerId ?? a.membershipId,
          name: b.name.trim(),
          metric: b.metric,
          target: b.target,
          startsAt,
          endsAt,
        })
        .returning();
      await this.record(a, row!, 'created', tx);
      return { ...row, etag: resourceETag(row) };
    });
  }
  async update(a: Actor, id: string, b: UpdateObjectiveDto, version?: string) {
    if (!Object.keys(b).length) throw new BadRequestException('Supply an objective change');
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const row = await this.row(a, id, true, tx);
      assertResourceMatches(version, row);
      const now = new Date();
      if (row.startsAt <= now) throw new ConflictException('Started objectives are immutable');
      const start = b.startsAt ? new Date(b.startsAt) : row.startsAt,
        end = b.endsAt ? new Date(b.endsAt) : row.endsAt;
      this.period(start, end);
      if (start <= now) throw new BadRequestException('Edited objective must start in the future');
      const [next] = await tx
        .update(o)
        .set({
          name: b.name?.trim() ?? row.name,
          target: b.target ?? row.target,
          startsAt: start,
          endsAt: end,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(o.tenantId, a.tenantId), eq(o.id, id)))
        .returning();
      await this.record(a, next!, 'updated', tx);
      return { ...next, etag: resourceETag(next) };
    });
  }
}
