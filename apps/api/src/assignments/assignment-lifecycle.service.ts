import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';
import {
  auditEvents,
  campaignProspects,
  establishments,
  campaignProspectAssignments as assignments,
} from '../database/schema/index.js';
import { establishmentFilterConditions } from '../establishments/establishment-filters.js';
import { postalDepartment } from '../establishments/postal-department.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { AssignmentBatchService } from './assignment-batch.service.js';
import { assertAssignmentCapacity } from '../memberships/assignment-capacity.js';
import type {
  AssignmentEndDto,
  AssignmentListDto,
  CreateAssignmentDto,
  ReassignAssignmentDto,
  UnassignedListDto,
  UpdateAssignmentDto,
} from './assignment-lifecycle.dto.js';
/*
 * The same establishment, owned right now by a prospector on another campaign.
 *
 * Shared between the filter and the projection so a row cannot be excluded by
 * one definition of "contested" and reported as free by another.
 */
const CONTESTED_ELSEWHERE = sql`EXISTS(SELECT 1 FROM campaign_prospects o JOIN campaign_prospect_assignments oa ON oa.tenant_id=o.tenant_id AND oa.campaign_prospect_id=o.id AND oa.ended_at IS NULL WHERE o.tenant_id=cp.tenant_id AND o.establishment_id=cp.establishment_id AND o.id<>cp.id)`;

@Injectable()
export class AssignmentLifecycleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly batches: AssignmentBatchService,
  ) {}
  private scope(a: AuthenticatedPrincipal) {
    // Historical rows are scoped to their own team/owner, never to a successor's owner.
    return sql`EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=${assignments.tenantId} AND g.user_id=${a.membershipId} AND (
      (g.scope_type='tenant' AND g.role IN ('client_admin','observer')) OR
      (g.scope_type='organization' AND g.organization_id=${assignments.organizationId} AND g.role IN ('director','observer')) OR
      (g.scope_type='team' AND g.team_id=${assignments.teamId} AND (g.role IN ('manager','observer') OR (g.role='prospector' AND (${assignments.assignedUserId} IS NULL OR ${assignments.assignedUserId}=${a.membershipId}))))))`;
  }
  async row(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [r] = await tx
      .select()
      .from(assignments)
      .where(and(eq(assignments.tenantId, a.tenantId), eq(assignments.id, id), this.scope(a)));
    if (!r) throw new NotFoundException('Assignment not found');
    return r;
  }
  async authorize(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const r = await this.row(a, id, tx);
    await this.batches.authorize(a, r.campaignId, [r.teamId], tx);
    return r;
  }
  async list(a: AuthenticatedPrincipal, q: AssignmentListDto): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, a.tenantId, () => this.list(a, q));
    const rows = await this.db
      .select({
        assignment: assignments,
        prospectName: establishments.name,
        campaignName: sql<string | null>`(
          SELECT c.name FROM campaigns c
          WHERE c.tenant_id = ${assignments.tenantId} AND c.id = ${assignments.campaignId}
        )`,
        teamName: sql<string | null>`(
          SELECT t.name FROM teams t
          WHERE t.tenant_id = ${assignments.tenantId} AND t.id = ${assignments.teamId}
        )`,
        managerName: sql<string | null>`(
          SELECT COALESCE(m.display_name, i.email)
          FROM tenant_memberships m
          JOIN identities i ON i.id = m.identity_id
          WHERE m.tenant_id = ${assignments.tenantId} AND m.id = ${assignments.managerId}
        )`,
        assignedUserName: sql<string | null>`(
          SELECT COALESCE(m.display_name, i.email)
          FROM tenant_memberships m
          JOIN identities i ON i.id = m.identity_id
          WHERE m.tenant_id = ${assignments.tenantId} AND m.id = ${assignments.assignedUserId}
        )`,
      })
      .from(assignments)
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspects.tenantId, assignments.tenantId),
          eq(campaignProspects.id, assignments.campaignProspectId),
        ),
      )
      .innerJoin(
        establishments,
        and(
          eq(establishments.tenantId, assignments.tenantId),
          eq(establishments.id, campaignProspects.establishmentId),
        ),
      )
      .where(
        and(
          eq(assignments.tenantId, a.tenantId),
          this.scope(a),
          q.campaignId ? eq(assignments.campaignId, q.campaignId) : undefined,
          q.teamId ? eq(assignments.teamId, q.teamId) : undefined,
          q.assignedUserId ? eq(assignments.assignedUserId, q.assignedUserId) : undefined,
          q.status ? eq(assignments.status, q.status) : undefined,
          q.cursor ? gt(assignments.id, q.cursor) : undefined,
        ),
      )
      .orderBy(assignments.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((r) => ({
        ...r.assignment,
        prospectName: r.prospectName,
        campaignName: r.campaignName,
        teamName: r.teamName,
        managerName: r.managerName,
        assignedUserName: r.assignedUserName,
        etag: resourceETag(r.assignment),
      })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.assignment.id : null,
    };
  }
  async detail(a: AuthenticatedPrincipal, id: string): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, a.tenantId, () => this.detail(a, id));
    const r = await this.row(a, id);
    const history = await this.db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.tenantId, a.tenantId),
          eq(assignments.campaignProspectId, r.campaignProspectId),
          this.scope(a),
        ),
      )
      .orderBy(assignments.assignedAt, assignments.id)
      .limit(101);
    const events = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          eq(auditEvents.resourceType, 'assignment'),
          eq(auditEvents.resourceId, id),
        ),
      )
      .orderBy(sql`${auditEvents.occurredAt} DESC`, sql`${auditEvents.id} DESC`)
      .limit(50);
    return {
      ...r,
      etag: resourceETag(r),
      history: history.slice(0, 100),
      historyTruncated: history.length > 100,
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        occurredAt: e.occurredAt,
        reason: e.metadata?.reason ?? null,
      })),
    };
  }
  /*
   * The prospects in a campaign that nobody owns — the list a manager dispatches
   * from.
   *
   * Availability is read from the durable assignment and nothing else. A live
   * reservation is deliberately not consulted: it is a Redis lease whose
   * eligibility check requires a current assignment, so no reservation can exist
   * on a row this query returns, and reading the `reservation_records` evidence
   * table here would add a join that is always empty.
   *
   * What a reservation *does* tell a manager is about a different campaign, and
   * `availability=uncontested` answers that from the assignments instead: an
   * establishment another campaign is actively working will refuse the
   * prospector's reservation under the organization collision scope, so it is
   * worth not dispatching in the first place.
   *
   * Ordering is by normalized name so that a 14,000-row base pages in an order a
   * human recognises and one an index can produce. The cursor stays a single
   * campaign-prospect id, as it has always been, and the name it sorts by is
   * resolved from it — the alternative would have changed the shape of a cursor
   * clients already hold.
   */
  async unassigned(a: AuthenticatedPrincipal, q: UnassignedListDto): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, a.tenantId, () => this.unassigned(a, q));
    await this.batches.authorize(a, q.campaignId, q.teamId ? [q.teamId] : null);
    const filters = [
      sql`cp.tenant_id=${a.tenantId}`,
      sql`cp.campaign_id=${q.campaignId}`,
      sql`cp.status='active'`,
      sql`c.status NOT IN ('completed','archived')`,
      sql`e.status='active'`,
      sql`NOT EXISTS(SELECT 1 FROM campaign_prospect_assignments x WHERE x.tenant_id=cp.tenant_id AND x.campaign_prospect_id=cp.id AND x.ended_at IS NULL)`,
    ];
    /*
     * Establishment filters come from the shared helper so the dispatch queue and
     * bulk enrolment cannot disagree about what a category or a department means.
     */
    filters.push(
      ...establishmentFilterConditions({
        ...(q.search === undefined ? {} : { search: q.search }),
        ...(q.category === undefined ? {} : { category: q.category }),
        ...(q.regionId === undefined ? {} : { regionId: q.regionId }),
        ...(q.department === undefined ? {} : { department: q.department }),
        ...(q.city === undefined ? {} : { city: q.city }),
      }),
    );
    if (q.lifecycleStage) filters.push(sql`cp.lifecycle_stage=${q.lifecycleStage}`);
    if (q.contactable) filters.push(sql`NOT trackroster_consent_blocked(cp.tenant_id,e.id,NULL)`);
    if (q.availability === 'uncontested') filters.push(sql`NOT ${CONTESTED_ELSEWHERE}`);
    if (q.cursor) {
      const seek = await this.db.execute<{ normalized_name: string }>(
        sql`SELECT e.normalized_name FROM campaign_prospects cp JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id WHERE cp.tenant_id=${a.tenantId} AND cp.campaign_id=${q.campaignId} AND cp.id=${q.cursor}`,
      );
      if (!seek.rows[0]) throw new BadRequestException('Cursor is outside this result');
      filters.push(
        sql`(e.normalized_name,cp.id)>(${seek.rows[0].normalized_name},${q.cursor}::uuid)`,
      );
    }
    const rows = await this.db.execute(
      sql`SELECT cp.id AS "campaignProspectId",cp.campaign_id AS "campaignId",cp.establishment_id AS "establishmentId",cp.lifecycle_stage AS "lifecycleStage",e.name,e.category,e.city,e.postal_code AS "postalCode",e.region_id AS "regionId",e.latitude,e.longitude,${postalDepartment(sql`e.postal_code`)} AS department,trackroster_consent_blocked(cp.tenant_id,e.id,NULL) AS "contactBlocked",${CONTESTED_ELSEWHERE} AS "activeElsewhere" FROM campaign_prospects cp JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id WHERE ${sql.join(filters, sql` AND `)} ORDER BY e.normalized_name,cp.id LIMIT ${q.limit + 1}`,
    );
    return {
      items: rows.rows.slice(0, q.limit),
      nextCursor: rows.rows.length > q.limit ? rows.rows[q.limit - 1]!.campaignProspectId : null,
    };
  }
  async create(a: AuthenticatedPrincipal, b: CreateAssignmentDto): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, a.tenantId, () => this.create(a, b));
    const result = await this.batches.run(
      a,
      {
        campaignId: b.campaignId,
        prospectIds: [b.campaignProspectId],
        teamId: b.teamId,
        assignedUserId: b.assignedUserId,
        managerMembershipId: b.managerMembershipId,
        deadlineAt: b.deadlineAt,
      },
      true,
    );
    return this.detail(a, result.decisions[0]!.assignmentId!);
  }
  async mutate(
    a: AuthenticatedPrincipal,
    id: string,
    op: 'update' | 'complete' | 'revoke' | 'reassign',
    b: UpdateAssignmentDto | AssignmentEndDto | ReassignAssignmentDto,
    version?: string,
  ): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, a.tenantId, () => this.mutate(a, id, op, b, version));
    if (Object.values(b).some((v) => v === null) && !('teamId' in b) && !('deadlineAt' in b))
      throw new BadRequestException('Fields cannot be null');
    if (op === 'update' && !Object.values(b).some((v) => v !== undefined))
      throw new BadRequestException('At least one change required');
    if ('reason' in b && b.reason.trim().length < 3)
      throw new BadRequestException('A meaningful reason is required');
    return this.db.transaction(async (tx) => {
      await this.batches.lock(a, tx);
      const initial = await this.authorize(a, id, tx);
      // Team and member locks precede assignment locks, as with other ownership writers.
      if (op === 'reassign') {
        const target = b as ReassignAssignmentDto;
        await this.batches.authorize(a, initial.campaignId, [target.teamId], tx);
        const states = await this.batches.targets(
          a,
          initial.organizationId,
          this.batches.normalize([target]),
          tx,
        );
        if (!states[0]!.eligible)
          throw new ConflictException('Assignment target is inactive or ineligible');
        await assertAssignmentCapacity(
          tx,
          a.tenantId,
          target.assignedUserId ?? null,
          target.teamId,
          initial.campaignProspectId,
        );
      }
      const cp = await tx.execute<{ status: string; campaign_status: string }>(
        sql`SELECT cp.status,c.status AS campaign_status FROM campaign_prospects cp JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id WHERE cp.tenant_id=${a.tenantId} AND cp.id=${initial.campaignProspectId} FOR SHARE OF cp,c`,
      );
      const [old] = await tx
        .select()
        .from(assignments)
        .where(and(eq(assignments.tenantId, a.tenantId), eq(assignments.id, id)))
        .for('update');
      if (!old) throw new NotFoundException('Assignment not found');
      assertResourceMatches(version, old);
      if (old.endedAt) throw new ConflictException('Assignment has ended');
      let result;
      if (op === 'update') {
        const input = b as UpdateAssignmentDto;
        [result] = await tx
          .update(assignments)
          .set({
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
            ...(input.deadlineAt !== undefined
              ? { deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null }
              : {}),
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(assignments.id, id))
          .returning();
      } else {
        if (op === 'reassign') {
          const target = b as ReassignAssignmentDto;
          if (
            old.teamId === target.teamId.toLowerCase() &&
            old.assignedUserId === (target.assignedUserId?.toLowerCase() ?? null) &&
            old.managerId === (target.managerMembershipId?.toLowerCase() ?? old.managerId)
          )
            throw new ConflictException('Select a different assignment target');
          if (
            cp.rows[0]?.status !== 'active' ||
            ['completed', 'archived'].includes(cp.rows[0]!.campaign_status)
          )
            throw new ConflictException('Prospect or campaign is no longer assignable');
        }
        const endedAt = new Date();
        [result] = await tx
          .update(assignments)
          .set({
            endedAt,
            status: op === 'complete' ? 'completed' : 'revoked',
            endReason: (b as AssignmentEndDto).reason.trim(),
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(assignments.id, id))
          .returning();
        if (op === 'reassign') {
          const target = b as ReassignAssignmentDto;
          [result] = await tx
            .insert(assignments)
            .values({
              tenantId: a.tenantId,
              campaignId: old.campaignId,
              campaignProspectId: old.campaignProspectId,
              organizationId: old.organizationId,
              teamId: target.teamId,
              assignedUserId: target.assignedUserId ?? null,
              managerId:
                target.managerMembershipId === undefined
                  ? old.managerId
                  : (target.managerMembershipId ?? null),
              deadlineAt:
                target.deadlineAt === undefined
                  ? old.deadlineAt
                  : target.deadlineAt
                    ? new Date(target.deadlineAt)
                    : null,
              priority: old.priority,
              assignedAt: endedAt,
            })
            .returning();
        }
      }
      await tx.insert(auditEvents).values({
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        resourceType: 'assignment',
        resourceId: id,
        action: `assignment.${op}`,
        metadata: { before: old, after: result, reason: 'reason' in b ? b.reason.trim() : null },
      });
      return { ...result!, etag: resourceETag(result) };
    });
  }
}
