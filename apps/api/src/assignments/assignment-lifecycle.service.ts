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
import {
  auditEvents,
  campaignProspectAssignments as assignments,
} from '../database/schema/index.js';
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
  async list(a: AuthenticatedPrincipal, q: AssignmentListDto) {
    const rows = await this.db
      .select()
      .from(assignments)
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
      items: rows.slice(0, q.limit).map((r) => ({ ...r, etag: resourceETag(r) })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async detail(a: AuthenticatedPrincipal, id: string) {
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
  async unassigned(a: AuthenticatedPrincipal, q: UnassignedListDto) {
    await this.batches.authorize(a, q.campaignId, q.teamId ? [q.teamId] : null);
    const rows = await this.db.execute(
      sql`SELECT cp.id AS "campaignProspectId",cp.campaign_id AS "campaignId",cp.establishment_id AS "establishmentId",e.name FROM campaign_prospects cp JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id WHERE cp.tenant_id=${a.tenantId} AND cp.campaign_id=${q.campaignId} AND cp.status='active' AND c.status NOT IN ('completed','archived') AND e.status='active' AND NOT EXISTS(SELECT 1 FROM campaign_prospect_assignments x WHERE x.tenant_id=cp.tenant_id AND x.campaign_prospect_id=cp.id AND x.ended_at IS NULL) ${q.cursor ? sql`AND cp.id>${q.cursor}::uuid` : sql``} ORDER BY cp.id LIMIT ${q.limit + 1}`,
    );
    return {
      items: rows.rows.slice(0, q.limit),
      nextCursor: rows.rows.length > q.limit ? rows.rows[q.limit - 1]!.campaignProspectId : null,
    };
  }
  async create(a: AuthenticatedPrincipal, b: CreateAssignmentDto) {
    const result = await this.batches.run(
      a,
      {
        campaignId: b.campaignId,
        prospectIds: [b.campaignProspectId],
        teamId: b.teamId,
        assignedUserId: b.assignedUserId,
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
  ) {
    if (Object.values(b).some((v) => v === null) && !('teamId' in b))
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
            ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(assignments.id, id))
          .returning();
      } else {
        if (op === 'reassign') {
          const target = b as ReassignAssignmentDto;
          if (
            old.teamId === target.teamId.toLowerCase() &&
            old.assignedUserId === (target.assignedUserId?.toLowerCase() ?? null)
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
