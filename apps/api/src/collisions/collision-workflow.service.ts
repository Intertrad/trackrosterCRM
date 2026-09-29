import { ReservationPolicyService } from '../reservations/reservation-policy.service.js';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { prospectReadScope } from '../actions/action-access.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaignProspectAssignments,
  collisionEvents,
  collisionOverrides,
  organizationCoordinationPolicies,
  overrideRequests,
  tenantMemberships,
  tenants,
} from '../database/schema/index.js';
import { PermissionService } from '../permissions/permission.service.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { CollisionDecisionService } from './collision-decision.service.js';
import {
  buildCollisionOverrideConflictKey,
  isOverrideableCollisionReason,
} from './collision-override-key.js';
import type { CheckCollisionDto, CollisionListDto } from './collision-workflow.dto.js';
import type { CollisionDecisionResult } from './collision.types.js';

type Event = typeof collisionEvents.$inferSelect;
type Operation = 'approve' | 'reject' | 'cancel';
@Injectable()
export class CollisionWorkflowService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly evaluator: CollisionDecisionService,
    private readonly reservations: ReservationService,
    private readonly authorization: AuthorizationService,
    private readonly permissions: PermissionService,
    private readonly config: ConfigService,
    private readonly reservationPolicy: ReservationPolicyService,
  ) {}
  // Keep the same tenant -> membership -> assignment order as action mutations.
  private async lock(auth: AuthenticatedPrincipal, tx: DatabaseExecutor, members: string[] = []) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('no key update');
    const membersNow = await tx
      .select({ id: tenantMemberships.id, status: tenantMemberships.status })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          inArray(tenantMemberships.id, [...new Set([auth.membershipId, ...members])]),
        ),
      )
      .orderBy(tenantMemberships.id)
      .for('key share');
    if (!membersNow.some((member) => member.id === auth.membershipId && member.status === 'active'))
      throw new ForbiddenException('Membership is not active');
  }
  async authorizeCheck(auth: AuthenticatedPrincipal, input: CheckCollisionDto) {
    const context = await this.reservations.requireReservationEligibility({
      tenantId: auth.tenantId,
      userId: auth.membershipId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
    });
    await this.checkConsent(auth, context.establishmentId);
    return context;
  }
  private async checkConsent(auth: AuthenticatedPrincipal, establishmentId: string) {
    const result = await this.db.execute<{ blocked: boolean }>(
      sql`SELECT trackroster_consent_blocked(${auth.tenantId}::uuid,${establishmentId}::uuid,NULL) AS blocked`,
    );
    if (result.rows[0]?.blocked)
      throw new ConflictException({
        code: 'CONTACT_BLOCKED',
        message: 'Prospect opposition cannot be overridden',
      });
  }
  private safeDecision(result: CollisionDecisionResult) {
    const c = result.conflict;
    // A conflict can belong to a campaign the reader cannot see. Never return its IDs or owner.
    const conflict = !c
      ? null
      : 'expiresAt' in c
        ? { expiresAt: c.expiresAt }
        : 'dueAt' in c
          ? { dueAt: c.dueAt }
          : 'assignedAt' in c
            ? { assignedAt: c.assignedAt }
            : null;
    return {
      decision: result.decision,
      reasonCode: result.reasonCode,
      establishmentId: result.establishmentId,
      conflict,
    };
  }
  private publicEvent(e: Event) {
    return {
      id: e.id,
      tenantId: e.tenantId,
      campaignId: e.campaignId,
      campaignProspectId: e.campaignProspectId,
      assignmentId: e.assignmentId,
      detectedBy: e.detectedBy,
      createdAt: e.createdAt,
      expiresAt: e.expiresAt,
      ...this.safeDecision(e.evaluation),
      policy: {
        evaluatorVersion: e.policySnapshot.evaluatorVersion,
        defaultCoolingOffMinutes: e.policySnapshot.defaultCoolingOffMinutes,
      },
      overrideable:
        this.overrideable(e.evaluation) &&
        (e.policySnapshot.reservationRule as { allowManagerOverride?: boolean } | undefined)
          ?.allowManagerOverride !== false,
    };
  }
  private overrideable(result: CollisionDecisionResult) {
    return (
      ['block', 'require_override'].includes(result.decision) &&
      isOverrideableCollisionReason(result.reasonCode) &&
      !!result.conflict
    );
  }
  private async currentAssignment(
    auth: AuthenticatedPrincipal,
    event: Pick<Event, 'campaignProspectId' | 'assignmentId'>,
    tx: DatabaseExecutor,
  ) {
    const [assignment] = await tx
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, auth.tenantId),
          eq(campaignProspectAssignments.campaignProspectId, event.campaignProspectId),
          sql`${campaignProspectAssignments.endedAt} IS NULL`,
        ),
      )
      .for('update');
    if (!assignment || assignment.id !== event.assignmentId)
      throw new ConflictException('Assignment changed; check the collision again');
    return assignment;
  }
  private async audit(
    auth: AuthenticatedPrincipal,
    tx: DatabaseExecutor,
    cp: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    // Target-safe metadata also appears in the canonical prospect timeline.
    await tx.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      resourceType: 'campaign_prospect',
      resourceId: cp,
      action,
      metadata,
    });
  }
  async check(auth: AuthenticatedPrincipal, input: CheckCollisionDto) {
    return this.db.transaction(async (tx) => {
      await this.lock(auth, tx);
      const context = await this.authorizeCheck(auth, input);
      await this.currentAssignment(
        auth,
        { campaignProspectId: input.campaignProspectId, assignmentId: context.assignment.id },
        tx,
      );
      const policies = await tx
        .select()
        .from(organizationCoordinationPolicies)
        .where(
          and(
            eq(organizationCoordinationPolicies.tenantId, auth.tenantId),
            or(
              eq(
                organizationCoordinationPolicies.organizationAId,
                context.assignment.organizationId,
              ),
              eq(
                organizationCoordinationPolicies.organizationBId,
                context.assignment.organizationId,
              ),
            ),
          ),
        )
        .orderBy(organizationCoordinationPolicies.id)
        .for('share');
      const result = await this.evaluator.evaluate({
        tenantId: auth.tenantId,
        userId: auth.membershipId,
        campaignId: input.campaignId,
        campaignProspectId: input.campaignProspectId,
      });
      if (result.decision === 'allow')
        return { ...this.safeDecision(result), collisionId: null, overrideable: false };
      const now = new Date();
      const [event] = await tx
        .insert(collisionEvents)
        .values({
          tenantId: auth.tenantId,
          ...input,
          establishmentId: result.establishmentId,
          assignmentId: context.assignment.id,
          detectedBy: auth.membershipId,
          decision: result.decision,
          reasonCode: result.reasonCode,
          conflictKey: this.overrideable(result) ? buildCollisionOverrideConflictKey(result) : null,
          evaluation: result,
          policySnapshot: {
            evaluatorVersion: 'collision-business-v3',
            reservationRule: await this.reservationPolicy.resolve(
              auth.tenantId,
              input.campaignId,
              tx,
            ),
            defaultCoolingOffMinutes: Number(
              this.config.getOrThrow('PROSPECT_COOLING_OFF_MINUTES'),
            ),
            targetOrganizationId: context.assignment.organizationId,
            coordinationPolicies: policies,
          },
          createdAt: now,
          expiresAt: new Date(now.getTime() + 10 * 60000),
        })
        .returning();
      await this.audit(auth, tx, input.campaignProspectId, 'collision.detected', {
        collisionId: event!.id,
        decision: result.decision,
        reasonCode: result.reasonCode,
      });
      return { ...this.publicEvent(event!), collisionId: event!.id };
    });
  }
  async event(auth: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [event] = await tx
      .select()
      .from(collisionEvents)
      .where(
        and(
          eq(collisionEvents.tenantId, auth.tenantId),
          eq(collisionEvents.id, id),
          prospectReadScope(auth, sql`${collisionEvents.campaignProspectId}`),
        ),
      );
    if (!event) throw new NotFoundException('Collision event not found');
    return event;
  }
  async eventDetail(auth: AuthenticatedPrincipal, id: string) {
    return this.publicEvent(await this.event(auth, id));
  }
  async listEvents(auth: AuthenticatedPrincipal, q: CollisionListDto) {
    const rows = await this.db
      .select()
      .from(collisionEvents)
      .where(
        and(
          eq(collisionEvents.tenantId, auth.tenantId),
          prospectReadScope(auth, sql`${collisionEvents.campaignProspectId}`),
          q.campaignId ? eq(collisionEvents.campaignId, q.campaignId) : undefined,
          q.reasonCode
            ? eq(collisionEvents.reasonCode, q.reasonCode as Event['reasonCode'])
            : undefined,
          q.cursor ? gt(collisionEvents.id, q.cursor) : undefined,
        ),
      )
      .orderBy(collisionEvents.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((r) => this.publicEvent(r)),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async authorizeRequest(auth: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const event = await this.event(auth, id, tx);
    if (event.detectedBy !== auth.membershipId)
      throw new NotFoundException('Collision event not found');
    await this.authorizeCheck(auth, event);
    return event;
  }
  private async recheck(auth: AuthenticatedPrincipal, event: Event, userId: string) {
    await this.checkConsent(auth, event.establishmentId);
    const reservationRule = await this.reservationPolicy.resolve(auth.tenantId, event.campaignId);
    if (!reservationRule.allowManagerOverride)
      throw new ConflictException('Reservation policy does not allow manager exceptions');
    if (
      !isDeepStrictEqual(
        JSON.parse(JSON.stringify(reservationRule)),
        event.policySnapshot.reservationRule,
      )
    )
      throw new ConflictException('Reservation policy changed; check again');
    const targetOrg = String(event.policySnapshot.targetOrganizationId);
    const currentPolicies = await this.db
      .select()
      .from(organizationCoordinationPolicies)
      .where(
        and(
          eq(organizationCoordinationPolicies.tenantId, auth.tenantId),
          or(
            eq(organizationCoordinationPolicies.organizationAId, targetOrg),
            eq(organizationCoordinationPolicies.organizationBId, targetOrg),
          ),
        ),
      )
      .orderBy(organizationCoordinationPolicies.id);
    if (
      !isDeepStrictEqual(
        JSON.parse(JSON.stringify(currentPolicies)),
        event.policySnapshot.coordinationPolicies,
      ) ||
      Number(this.config.getOrThrow('PROSPECT_COOLING_OFF_MINUTES')) !==
        event.policySnapshot.defaultCoolingOffMinutes
    )
      throw new ConflictException('Collision policy changed; check again');
    if (event.expiresAt.getTime() <= Date.now())
      throw new ConflictException('Collision evidence expired; check again');
    const result = await this.evaluator.evaluate({
      tenantId: auth.tenantId,
      userId,
      campaignId: event.campaignId,
      campaignProspectId: event.campaignProspectId,
    });
    if (
      !this.overrideable(result) ||
      !event.conflictKey ||
      buildCollisionOverrideConflictKey(result) !== event.conflictKey ||
      result.decision !== event.decision
    )
      throw new ConflictException('Collision changed or cannot be overridden; check again');
    return result;
  }
  async request(auth: AuthenticatedPrincipal, id: string, reason: string) {
    this.reason(reason);
    return this.db.transaction(async (tx) => {
      await this.lock(auth, tx);
      const event = await this.authorizeRequest(auth, id, tx);
      await this.currentAssignment(auth, event, tx);
      await this.recheck(auth, event, auth.membershipId);
      const [pending] = await tx
        .select()
        .from(overrideRequests)
        .where(
          and(
            eq(overrideRequests.tenantId, auth.tenantId),
            eq(overrideRequests.campaignProspectId, event.campaignProspectId),
            eq(overrideRequests.requestedBy, auth.membershipId),
            eq(overrideRequests.status, 'pending'),
          ),
        );
      if (pending)
        throw new ConflictException('A pending override request already exists for this prospect');
      const [row] = await tx
        .insert(overrideRequests)
        .values({
          tenantId: auth.tenantId,
          collisionId: id,
          campaignProspectId: event.campaignProspectId,
          requestedBy: auth.membershipId,
          reason: reason.trim(),
        })
        .returning();
      await this.audit(auth, tx, event.campaignProspectId, 'override.requested', {
        requestId: row!.id,
        collisionId: id,
        reason: row!.reason,
      });
      return { ...row!, etag: resourceETag(row!) };
    });
  }
  async requestRow(auth: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [row] = await tx
      .select()
      .from(overrideRequests)
      .where(
        and(
          eq(overrideRequests.tenantId, auth.tenantId),
          eq(overrideRequests.id, id),
          prospectReadScope(auth, sql`${overrideRequests.campaignProspectId}`),
        ),
      );
    if (!row) throw new NotFoundException('Override request not found');
    return row;
  }
  async requestDetail(auth: AuthenticatedPrincipal, id: string) {
    const row = await this.requestRow(auth, id);
    const event = await this.event(auth, row.collisionId);
    const [approval] = row.overrideId
      ? await this.db
          .select({ id: collisionOverrides.id, expiresAt: collisionOverrides.expiresAt })
          .from(collisionOverrides)
          .where(
            and(
              eq(collisionOverrides.tenantId, auth.tenantId),
              eq(collisionOverrides.id, row.overrideId),
            ),
          )
      : [];
    return {
      ...row,
      etag: resourceETag(row),
      collision: this.publicEvent(event),
      approval: approval ?? null,
    };
  }
  async listRequests(auth: AuthenticatedPrincipal, q: CollisionListDto) {
    const rows = await this.db
      .select({ request: overrideRequests })
      .from(overrideRequests)
      .innerJoin(
        collisionEvents,
        and(
          eq(collisionEvents.tenantId, overrideRequests.tenantId),
          eq(collisionEvents.id, overrideRequests.collisionId),
        ),
      )
      .where(
        and(
          eq(overrideRequests.tenantId, auth.tenantId),
          prospectReadScope(auth, sql`${overrideRequests.campaignProspectId}`),
          q.campaignId ? eq(collisionEvents.campaignId, q.campaignId) : undefined,
          q.status ? eq(overrideRequests.status, q.status) : undefined,
          q.reasonCode
            ? eq(collisionEvents.reasonCode, q.reasonCode as Event['reasonCode'])
            : undefined,
          q.cursor ? gt(overrideRequests.id, q.cursor) : undefined,
        ),
      )
      .orderBy(overrideRequests.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map(({ request: r }) => ({ ...r, etag: resourceETag(r) })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.request.id : null,
    };
  }
  async authorizeDecision(
    auth: AuthenticatedPrincipal,
    id: string,
    op: Operation,
    tx: DatabaseExecutor = this.db,
  ) {
    if (op === 'cancel') {
      // Closing one's own request does not grant access to the prospect's new scope.
      const [owned] = await tx
        .select()
        .from(overrideRequests)
        .where(
          and(
            eq(overrideRequests.tenantId, auth.tenantId),
            eq(overrideRequests.id, id),
            eq(overrideRequests.requestedBy, auth.membershipId),
          ),
        );
      if (!owned) throw new NotFoundException('Override request not found');
      return owned;
    }
    const row = await this.requestRow(auth, id, tx);
    if (row.requestedBy === auth.membershipId)
      throw new ConflictException('Requests require an independent manager decision');
    const event = await this.event(auth, row.collisionId, tx);
    const [assignment] = await tx
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, auth.tenantId),
          eq(campaignProspectAssignments.campaignProspectId, row.campaignProspectId),
          or(
            sql`${campaignProspectAssignments.endedAt} IS NULL`,
            eq(campaignProspectAssignments.id, event.assignmentId),
          ),
        ),
      )
      .orderBy(sql`${campaignProspectAssignments.endedAt} NULLS FIRST`)
      .limit(1);
    if (!assignment) throw new NotFoundException('Override request not found');
    const authority = await this.authorization.getOverrideAuthority(
      auth.tenantId,
      auth.membershipId,
      assignment.organizationId,
      assignment.teamId,
    );
    if (!authority) throw new NotFoundException('Override request not found');
    await this.permissions.assertAllowed(auth, 'collisions.override', assignment);
    if (
      op === 'approve' &&
      !(await this.reservationPolicy.resolve(auth.tenantId, event.campaignId)).allowManagerOverride
    )
      throw new ConflictException('Reservation policy does not allow manager exceptions');
    if (op === 'approve')
      await this.checkConsent(auth, (await this.event(auth, row.collisionId, tx)).establishmentId);
    return row;
  }
  private reason(value: string) {
    if (typeof value !== 'string' || value.trim().length < 10 || value.trim().length > 1000)
      throw new BadRequestException('Reason must be between 10 and 1000 characters');
  }
  async decide(
    auth: AuthenticatedPrincipal,
    id: string,
    op: Operation,
    reason: string,
    etag?: string,
  ) {
    this.reason(reason);
    const initial = await this.authorizeDecision(auth, id, op);
    return this.db.transaction(async (tx) => {
      await this.lock(auth, tx, [initial.requestedBy]);
      const row = await this.authorizeDecision(auth, id, op, tx);
      assertResourceMatches(etag, row);
      if (row.status !== 'pending')
        throw new ConflictException('Override request is already decided');
      const [event] = await tx
        .select()
        .from(collisionEvents)
        .where(
          and(eq(collisionEvents.tenantId, auth.tenantId), eq(collisionEvents.id, row.collisionId)),
        );
      if (!event) throw new NotFoundException('Collision event not found');
      let overrideId: string | null = null;
      let expiresAt: Date | null = null;
      if (op === 'approve') {
        const assignment = await this.currentAssignment(auth, event, tx);
        const result = await this.recheck(auth, event, row.requestedBy);
        const authority = await this.authorization.getOverrideAuthority(
          auth.tenantId,
          auth.membershipId,
          assignment.organizationId,
          assignment.teamId,
        );
        if (!authority) throw new NotFoundException('Override request not found');
        await this.permissions.assertAllowed(auth, 'collisions.override', assignment);
        const now = new Date();
        expiresAt = new Date(now.getTime() + 10 * 60000);
        const [approval] = await tx
          .insert(collisionOverrides)
          .values({
            tenantId: auth.tenantId,
            campaignId: event.campaignId,
            campaignProspectId: event.campaignProspectId,
            establishmentId: event.establishmentId,
            assignmentId: assignment.id,
            organizationId: assignment.organizationId,
            teamId: assignment.teamId,
            prospectorUserId: row.requestedBy,
            approvedByUserId: auth.membershipId,
            approvedByRole: authority,
            reasonCode: result.reasonCode as
              'PLANNED_ACTION' | 'RECENT_CONTACT' | 'ACTIVE_ASSIGNMENT',
            conflictKey: buildCollisionOverrideConflictKey(result),
            conflictSnapshot: { ...result.conflict! },
            reason: reason.trim(),
            expiresAt,
            createdAt: now,
          })
          .returning();
        overrideId = approval!.id;
      }
      const [updated] = await tx
        .update(overrideRequests)
        .set({
          status: op === 'approve' ? 'approved' : op === 'reject' ? 'rejected' : 'cancelled',
          decidedBy: auth.membershipId,
          decisionReason: reason.trim(),
          decidedAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
          overrideId,
        })
        .where(and(eq(overrideRequests.tenantId, auth.tenantId), eq(overrideRequests.id, id)))
        .returning();
      await this.audit(auth, tx, event.campaignProspectId, `override.${updated!.status}`, {
        requestId: id,
        collisionId: event.id,
        overrideId,
        reason: reason.trim(),
      });
      return {
        ...updated!,
        etag: resourceETag(updated!),
        approval: overrideId ? { id: overrideId, expiresAt } : null,
      };
    });
  }
}
