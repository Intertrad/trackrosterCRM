import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, getTableColumns, gt, isNull, sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  prospectFollowUps as f,
  campaignProspectAssignments as assignments,
  campaignProspects,
  campaigns,
  establishments,
  teams,
  tenants,
  auditEvents,
} from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { FollowUpReminderSchedulerService } from './follow-up-reminder-scheduler.service.js';
import type { ListFollowUpQueueQueryDto } from './list-follow-up-queue-query.dto.js';
import type { UpdateFollowUpDto } from './canonical-follow-up.controller.js';
@Injectable()
export class CanonicalFollowUpService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scheduler: FollowUpReminderSchedulerService,
    private readonly authorizationService: AuthorizationService,
  ) {}
  private scope(a: AuthenticatedPrincipal, write = false): SQL {
    return sql`EXISTS(SELECT 1 FROM campaign_prospect_assignments ca JOIN user_access_grants g ON g.tenant_id=ca.tenant_id AND g.user_id=${a.membershipId} JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE ca.tenant_id=${a.tenantId} AND ca.id=${f.assignmentId} AND m.status='active' AND i.status='active' AND (
   (g.scope_type='tenant' AND g.role IN ${write ? sql`('client_admin')` : sql`('client_admin','observer')`}) OR
   (g.scope_type='organization' AND g.organization_id=ca.organization_id AND g.role IN ${write ? sql`('director')` : sql`('director','observer')`}) OR
   (g.scope_type='team' AND g.team_id=ca.team_id AND (g.role='manager' ${write ? sql`` : sql`OR g.role='observer'`} OR (g.role='prospector' AND (ca.assigned_user_id IS NULL OR ca.assigned_user_id=${a.membershipId}) AND (${f.assignedUserId} IS NULL OR ${f.assignedUserId}=${a.membershipId}))))))`;
  }
  async row(a: AuthenticatedPrincipal, id: string, write = false, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select()
      .from(f)
      .where(and(eq(f.tenantId, a.tenantId), eq(f.id, id), this.scope(a, write)));
    if (!row) throw new NotFoundException('Follow-up not found');
    return row;
  }
  async list(a: AuthenticatedPrincipal, q: ListFollowUpQueueQueryDto) {
    if (q.teamId) {
      const [team] = await this.db
        .select({ organizationId: teams.organizationId })
        .from(teams)
        .where(and(eq(teams.tenantId, a.tenantId), eq(teams.id, q.teamId)))
        .limit(1);

      const grants = team
        ? await this.authorizationService.getUserGrants(a.tenantId, a.membershipId)
        : [];
      const canViewTeam = Boolean(
        team &&
        grants.some(
          (grant) =>
            (grant.scopeType === 'tenant' &&
              (grant.role === 'client_admin' || grant.role === 'observer')) ||
            (grant.scopeType === 'organization' &&
              grant.organizationId === team.organizationId &&
              (grant.role === 'director' || grant.role === 'observer')) ||
            (grant.scopeType === 'team' &&
              grant.teamId === q.teamId &&
              (grant.role === 'manager' ||
                grant.role === 'prospector' ||
                grant.role === 'observer')),
        ),
      );

      if (!canViewTeam) {
        throw new ForbiddenException('User does not have access to this team');
      }
    }

    const status = q.status ?? 'pending';
    const where = [eq(f.tenantId, a.tenantId), this.scope(a)];
    if (status !== 'all')
      where.push(
        eq(
          f.status,
          ['due', 'missed'].includes(status)
            ? 'pending'
            : (status as 'pending' | 'completed' | 'cancelled'),
        ),
      );
    if (status === 'missed' || q.overdue === true)
      where.push(sql`${f.status}='pending' AND ${f.dueAt}<now()`);
    if (status === 'due')
      where.push(sql`${f.dueAt}>=now() AND ${f.dueAt}<now()+interval '24 hours'`);
    if (q.overdue === false) where.push(sql`${f.dueAt}>=now()`);
    if (q.teamId)
      where.push(
        sql`EXISTS(SELECT 1 FROM campaign_prospect_assignments a WHERE a.tenant_id=${a.tenantId} AND a.id=${f.assignmentId} AND a.team_id=${q.teamId})`,
      );
    if (q.campaignId) where.push(eq(f.campaignId, q.campaignId));
    if (q.cursor) where.push(gt(f.id, q.cursor));
    const rows = await this.db
      .select({
        ...getTableColumns(f),
        campaignName: campaigns.name,
        establishmentName: establishments.name,
      })
      .from(f)
      .innerJoin(
        assignments,
        and(eq(assignments.tenantId, f.tenantId), eq(assignments.id, f.assignmentId)),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspects.tenantId, f.tenantId),
          eq(campaignProspects.id, f.campaignProspectId),
          eq(campaignProspects.campaignId, f.campaignId),
        ),
      )
      .innerJoin(campaigns, and(eq(campaigns.tenantId, f.tenantId), eq(campaigns.id, f.campaignId)))
      .innerJoin(
        establishments,
        and(eq(establishments.tenantId, f.tenantId), eq(establishments.id, f.establishmentId)),
      )
      .where(
        and(
          ...where,
          isNull(assignments.endedAt),
          eq(campaignProspects.status, 'active'),
          eq(campaigns.status, 'active'),
        ),
      )
      .orderBy(f.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((r) => ({
        ...r,
        etag: resourceETag(r),
        isOverdue: r.status === 'pending' && r.dueAt.getTime() < Date.now(),
      })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async detail(a: AuthenticatedPrincipal, id: string) {
    const row = await this.row(a, id);
    const history = await this.db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        metadata: auditEvents.metadata,
        createdAt: auditEvents.occurredAt,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          eq(auditEvents.resourceType, 'follow_up'),
          eq(auditEvents.resourceId, id),
        ),
      )
      .orderBy(sql`${auditEvents.occurredAt} DESC`, sql`${auditEvents.id} DESC`)
      .limit(50);
    const sourceAction = await this.db.execute<{ actionId: string }>(
      sql`SELECT ac.id AS "actionId" FROM action_effects e JOIN actions ac ON ac.tenant_id=e.tenant_id AND ac.id=e.action_id WHERE e.tenant_id=${a.tenantId} AND e.type='schedule_follow_up' AND e.payload->>'followUpId'=${id} AND ac.campaign_prospect_id=${row.campaignProspectId} LIMIT 1`,
    );
    return {
      ...row,
      etag: resourceETag(row),
      source: {
        assignmentId: row.assignmentId,
        createdBy: row.createdBy,
        actionId: sourceAction.rows[0]?.actionId ?? null,
      },
      nextAction: { category: row.category, channel: row.channel, dueAt: row.dueAt },
      history,
    };
  }
  async mutate(
    a: AuthenticatedPrincipal,
    id: string,
    op: 'update' | 'complete' | 'cancel',
    b: UpdateFollowUpDto & { reason?: string },
    version?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, a.tenantId))
        .for('no key update');
      const initial = await this.row(a, id, true, tx);
      const [assignment] = await tx
        .select()
        .from(assignments)
        .where(and(eq(assignments.tenantId, a.tenantId), eq(assignments.id, initial.assignmentId)))
        .for('update');
      const [row] = await tx
        .select()
        .from(f)
        .where(and(eq(f.tenantId, a.tenantId), eq(f.id, id)))
        .for('update');
      if (!row) throw new NotFoundException('Follow-up not found');
      assertResourceMatches(version, row);
      if (row.status !== 'pending') throw new ConflictException('Follow-up is already finalized');
      if (op === 'complete' && row.reviewStatus === 'pending') {
        throw new ConflictException('Follow-up requires manager review before completion');
      }
      // Cancellation remains available to clean up obsolete ownership. Other changes
      // must refer to a live, unpaused assignment.
      if (op !== 'cancel' && (!assignment || assignment.endedAt || assignment.status !== 'active'))
        throw new ConflictException('Assignment is no longer active');
      const now = new Date();
      const values: Partial<typeof f.$inferInsert> = { updatedAt: now };
      if (op === 'update') {
        if (b.dueAt === undefined && b.category === undefined && b.channel === undefined)
          throw new BadRequestException('Supply a follow-up change');
        if (b.dueAt !== undefined) {
          const dueAt = new Date(b.dueAt);
          if (dueAt <= now) throw new BadRequestException('Due date must be in the future');
          try {
            await this.scheduler.schedule({
              tenantId: a.tenantId,
              followUpId: id,
              campaignId: row.campaignId,
              campaignProspectId: row.campaignProspectId,
              dueAt,
            });
          } catch {
            throw new ServiceUnavailableException('Reminder scheduling unavailable');
          }
          values.dueAt = dueAt;
        }
        if (b.category !== undefined) values.category = b.category;
        if (b.channel !== undefined) values.channel = b.channel;
      } else if (op === 'complete') {
        values.status = 'completed';
        values.completedAt = now;
        values.completedLate = row.completedLate || row.dueAt.getTime() < now.getTime();
      } else {
        values.status = 'cancelled';
        values.cancelledAt = now;
      }
      const [next] = await tx
        .update(f)
        .set(values)
        .where(and(eq(f.tenantId, a.tenantId), eq(f.id, id), eq(f.status, 'pending')))
        .returning();
      if (!next) throw new ConflictException('Follow-up changed concurrently');
      await tx.insert(auditEvents).values({
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        resourceType: 'follow_up',
        resourceId: id,
        action: `follow_up.${op}`,
        metadata: {
          before: {
            status: row.status,
            dueAt: row.dueAt,
            category: row.category,
            channel: row.channel,
          },
          after: {
            status: next.status,
            dueAt: next.dueAt,
            category: next.category,
            channel: next.channel,
          },
          reason: b.reason ?? null,
        },
      });
      return { ...next, etag: resourceETag(next) };
    });
  }
}
