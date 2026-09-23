import { resolveOutcome } from '../outcome-settings/outcome-settings.service.js';
import { prospectReadScope } from './action-access.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  actions,
  actionEvents,
  actionOutcomes,
  actionEffects,
  auditEvents,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  contactConsents,
  establishments,
  establishmentContacts,
  prospectActivities,
  prospectFollowUps,
  tenantMemberships,
  tenants,
} from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { rethrowConsentBlock } from '../consents/consent-error.js';
import type {
  CompleteActionDto,
  CorrectionDto,
  CreateActionDto,
  ListActionsDto,
  ReasonDto,
  StartActionDto,
  UpdateActionDto,
} from './action.dto.js';
@Injectable()
export class ActionService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reservations: ReservationService,
    private readonly reservationRepository: ReservationRepository,
  ) {}
  async authorize(
    auth: AuthenticatedPrincipal,
    id: string,
    write = false,
    execute = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const [row] = await tx
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.tenantId, auth.tenantId),
          eq(actions.id, id),
          prospectReadScope(auth, sql`${actions.campaignProspectId}`, write),
        ),
      );
    if (!row || (execute && row.assigneeMembershipId !== auth.membershipId))
      throw new NotFoundException('Action not found');
    if (execute && this.contact(row.type)) {
      const [assignment] = await tx
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, auth.tenantId),
            eq(campaignProspectAssignments.id, row.assignmentId),
          ),
        );
      if (assignment?.status === 'paused') throw new ConflictException('Assignment is paused');
      await this.checkConsent(auth, row, tx);
    }
    return row;
  }
  private contact(type: string) {
    return ['call', 'email', 'message', 'visit'].includes(type);
  }
  private async checkConsent(
    auth: AuthenticatedPrincipal,
    row: typeof actions.$inferSelect,
    tx: DatabaseExecutor,
  ) {
    const channel = row.type === 'call' ? 'phone' : row.type === 'message' ? 'sms' : row.type;
    const blocked = await tx.execute<{ blocked: boolean }>(
      sql`SELECT trackroster_consent_blocked(${auth.tenantId}::uuid,${row.establishmentId}::uuid,${channel}) AS blocked`,
    );
    if (blocked.rows[0]?.blocked)
      throw new ConflictException({
        code: 'CONTACT_BLOCKED',
        message: 'Prospect opposition blocks this contact channel',
      });
  }
  async list(auth: AuthenticatedPrincipal, q: ListActionsDto) {
    const rows = await this.db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.tenantId, auth.tenantId),
          prospectReadScope(auth, sql`${actions.campaignProspectId}`),
          q.campaignId ? eq(actions.campaignId, q.campaignId) : undefined,
          q.assigneeMembershipId
            ? eq(actions.assigneeMembershipId, q.assigneeMembershipId)
            : undefined,
          q.status ? eq(actions.status, q.status) : undefined,
          q.cursor ? gt(actions.id, q.cursor) : undefined,
        ),
      )
      .orderBy(actions.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((r) => ({ ...r, etag: resourceETag(r) })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async detail(auth: AuthenticatedPrincipal, id: string) {
    const action = await this.authorize(auth, id);
    const [outcome] = await this.db
      .select()
      .from(actionOutcomes)
      .where(and(eq(actionOutcomes.tenantId, auth.tenantId), eq(actionOutcomes.actionId, id)));
    const effects = await this.db
      .select({
        id: actionEffects.id,
        type: actionEffects.type,
        deliveredAt: actionEffects.deliveredAt,
      })
      .from(actionEffects)
      .where(and(eq(actionEffects.tenantId, auth.tenantId), eq(actionEffects.actionId, id)));
    return { ...action, etag: resourceETag(action), outcome: outcome ?? null, effects };
  }
  async events(auth: AuthenticatedPrincipal, id: string, q: ListActionsDto) {
    await this.authorize(auth, id);
    const rows = await this.db
      .select()
      .from(actionEvents)
      .where(
        and(
          eq(actionEvents.tenantId, auth.tenantId),
          eq(actionEvents.actionId, id),
          q.cursor ? gt(actionEvents.id, q.cursor) : undefined,
        ),
      )
      .orderBy(actionEvents.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  private async lock(auth: AuthenticatedPrincipal, tx: DatabaseExecutor, members: string[]) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('no key update');
    await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          inArray(tenantMemberships.id, [...new Set([auth.membershipId, ...members])]),
        ),
      )
      .orderBy(tenantMemberships.id)
      .for('key share');
  }
  async authorizeCreate(
    auth: AuthenticatedPrincipal,
    input: CreateActionDto,
    tx: DatabaseExecutor = this.db,
  ) {
    const [cp] = await tx
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, auth.tenantId),
          eq(campaignProspects.id, input.campaignProspectId),
          eq(campaignProspects.campaignId, input.campaignId),
          prospectReadScope(auth, sql`${campaignProspects.id}`, true),
        ),
      );
    if (!cp) throw new NotFoundException('Campaign prospect not found');
    return cp;
  }
  async create(auth: AuthenticatedPrincipal, input: CreateActionDto) {
    if (!input.subject?.trim()) throw new BadRequestException('Subject is required');
    return this.db.transaction(async (tx) => {
      const assignee = input.assigneeMembershipId ?? auth.membershipId;
      await this.lock(auth, tx, [assignee]);
      const cp = await this.authorizeCreate(auth, input, tx);
      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, cp.campaignId)))
        .for('share');
      if (
        cp.status !== 'active' ||
        !campaign ||
        ['completed', 'archived'].includes(campaign.status)
      )
        throw new ConflictException('Campaign prospect is not accepting planned actions');
      const [assignment] = await tx
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, auth.tenantId),
            eq(campaignProspectAssignments.campaignProspectId, cp.id),
            sql`${campaignProspectAssignments.endedAt} IS NULL`,
          ),
        )
        .for('share');
      if (!assignment) throw new ConflictException('An active assignment is required');
      const eligible = await tx.execute(
        sql`SELECT m.id FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id JOIN user_access_grants g ON g.tenant_id=m.tenant_id AND g.user_id=m.id WHERE m.tenant_id=${auth.tenantId} AND m.id=${assignee} AND m.status='active' AND i.status='active' AND g.role='prospector' AND g.scope_type='team' AND g.team_id=${assignment.teamId}`,
      );
      if (
        !eligible.rows.length ||
        (assignment.assignedUserId && assignment.assignedUserId !== assignee)
      )
        throw new BadRequestException(
          'Assignee must be an eligible prospector for this assignment',
        );
      if (assignee !== auth.membershipId) {
        const manage = await tx.execute(
          sql`SELECT id FROM user_access_grants WHERE tenant_id=${auth.tenantId} AND user_id=${auth.membershipId} AND ((role='client_admin' AND scope_type='tenant') OR (role='director' AND scope_type='organization' AND organization_id=${assignment.organizationId}) OR (role='manager' AND scope_type='team' AND team_id=${assignment.teamId}))`,
        );
        if (!manage.rows.length) throw new NotFoundException('Assignee not available');
      }
      const [row] = await tx
        .insert(actions)
        .values({
          tenantId: auth.tenantId,
          campaignId: cp.campaignId,
          campaignProspectId: cp.id,
          establishmentId: cp.establishmentId,
          assignmentId: assignment.id,
          assigneeMembershipId: assignee,
          createdBy: auth.membershipId,
          type: input.type,
          subject: input.subject.trim(),
          notes: input.notes,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        })
        .returning();
      await this.event(auth, row!, 'created', { after: row }, tx);
      return row!;
    });
  }
  async mutate(
    auth: AuthenticatedPrincipal,
    id: string,
    operation: 'update' | 'start' | 'complete' | 'cancel' | 'correction',
    input: UpdateActionDto | StartActionDto | CompleteActionDto | ReasonDto | CorrectionDto,
    ifMatch?: string,
  ) {
    const initial = await this.authorize(auth, id, true, ['start', 'complete'].includes(operation));
    try {
      return await this.db.transaction(async (tx) => {
        await this.lock(auth, tx, [initial.assigneeMembershipId]);
        const row = await this.authorize(
          auth,
          id,
          true,
          ['start', 'complete'].includes(operation),
          tx,
        );
        assertResourceMatches(ifMatch, row);
        const [assignment] = await tx
          .select()
          .from(campaignProspectAssignments)
          .where(
            and(
              eq(campaignProspectAssignments.tenantId, auth.tenantId),
              eq(campaignProspectAssignments.campaignProspectId, row.campaignProspectId),
              sql`${campaignProspectAssignments.endedAt} IS NULL`,
            ),
          )
          .for('update');
        if (
          assignment?.status === 'paused' &&
          !['cancel', 'correction'].includes(operation) &&
          !['task', 'note'].includes(row.type)
        )
          throw new ConflictException('Assignment is paused');
        if (!['cancel', 'correction'].includes(operation) && assignment?.id !== row.assignmentId)
          throw new ConflictException('Assignment changed; create a new action');
        if (operation === 'correction') {
          if (!['completed', 'cancelled'].includes(row.status))
            throw new ConflictException('Only finalized actions accept corrections');
          const correction = input as CorrectionDto;
          const definition = correction.outcomeCode
            ? await resolveOutcome(tx, auth.tenantId, correction.outcomeCode, row.type)
            : null;
          await this.event(
            auth,
            row,
            'correction',
            { ...correction, outcomeDefinition: definition },
            tx,
          );
          return row;
        }
        if (['completed', 'cancelled'].includes(row.status))
          throw new ConflictException('Action is already finalized');
        const [cp] = await tx
          .select()
          .from(campaignProspects)
          .where(
            and(
              eq(campaignProspects.tenantId, auth.tenantId),
              eq(campaignProspects.id, row.campaignProspectId),
            ),
          )
          .for('update');
        const [campaign] = await tx
          .select()
          .from(campaigns)
          .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, row.campaignId)))
          .for('share');
        if (operation !== 'cancel' && (cp?.status !== 'active' || campaign?.status !== 'active'))
          throw new ConflictException('Campaign prospect is not active');
        const [establishment] = await tx
          .select({ id: establishments.id, status: establishments.status })
          .from(establishments)
          .where(
            and(
              eq(establishments.tenantId, auth.tenantId),
              eq(establishments.id, row.establishmentId),
            ),
          )
          .for('update');
        if (['start', 'complete'].includes(operation) && establishment?.status !== 'active')
          throw new ConflictException('Prospect is inactive');
        if (['start', 'complete'].includes(operation) && this.contact(row.type))
          await this.checkConsent(auth, row, tx);
        const now = new Date();
        let values: Partial<typeof actions.$inferInsert> = { updatedAt: now };
        const evidence: Record<string, unknown> = { before: row };
        if (operation === 'update') {
          const update = input as UpdateActionDto;
          if (!Object.values(update).some((v) => v !== undefined))
            throw new BadRequestException('At least one editable field is required');
          values = {
            ...values,
            subject: update.subject?.trim(),
            notes: update.notes,
            dueAt:
              update.dueAt === undefined ? undefined : update.dueAt ? new Date(update.dueAt) : null,
          };
        } else if (operation === 'start') {
          if (row.status !== 'planned') throw new ConflictException('Action has already started');
          if (this.contact(row.type)) {
            await this.reservations.requireReservationEligibility({
              tenantId: auth.tenantId,
              userId: auth.membershipId,
              campaignId: row.campaignId,
              campaignProspectId: row.campaignProspectId,
            });
            const current = await this.reservationRepository.findCurrent(
              auth.tenantId,
              row.campaignId,
              row.campaignProspectId,
            );
            if (
              current &&
              (current.userId !== auth.membershipId || current.assignmentId !== row.assignmentId)
            )
              throw new ConflictException('Reservation is owned by another action context');
            if (current) {
              const pending = await tx
                .select({ id: actionEffects.id })
                .from(actionEffects)
                .where(
                  and(
                    eq(actionEffects.tenantId, auth.tenantId),
                    eq(actionEffects.type, 'release_reservation'),
                    sql`${actionEffects.deliveredAt} IS NULL AND ${actionEffects.payload}->>'reservationId' = ${current.reservationId}`,
                  ),
                );
              if (pending.length)
                throw new ConflictException('Reservation release is pending; retry after delivery');
            }
            const reservation =
              current ??
              (await this.reservations.acquire({
                tenantId: auth.tenantId,
                userId: auth.membershipId,
                campaignId: row.campaignId,
                campaignProspectId: row.campaignProspectId,
                overrideId: (input as StartActionDto).overrideId,
              }));
            if (reservation.assignmentId !== row.assignmentId)
              throw new ConflictException('Reservation assignment changed');
            values.reservationId = reservation.reservationId;
            evidence.reservationId = reservation.reservationId;
          }
          values.status = 'started';
          values.startedAt = now;
        } else if (operation === 'cancel') {
          values.status = 'cancelled';
          values.cancelledAt = now;
          evidence.reason = (input as ReasonDto).reason;
          if (row.reservationId)
            await this.releaseEffect(
              row,
              assignment?.organizationId ?? campaign!.organizationId,
              tx,
            );
        } else {
          if (row.status !== 'started')
            throw new ConflictException('Start the action before completing it');
          const complete = input as CompleteActionDto;
          const definition = await resolveOutcome(
            tx,
            auth.tenantId,
            complete.outcomeCode,
            row.type,
          );
          evidence.outcomeDefinition = definition;
          if (['task', 'note'].includes(row.type) && definition.behavior !== 'completed')
            throw new BadRequestException('Task and note actions use the completed outcome');
          if (this.contact(row.type) && definition.behavior === 'completed')
            throw new BadRequestException('Choose a contact outcome');
          if (complete.nextFollowUp && new Date(complete.nextFollowUp.dueAt) <= now)
            throw new BadRequestException('Next follow-up must be in the future');
          if (definition.behavior === 'do_not_contact' && complete.nextFollowUp)
            throw new BadRequestException('Opposition cannot schedule another contact');
          if (this.contact(row.type)) {
            await this.reservations.requireReservationEligibility({
              tenantId: auth.tenantId,
              userId: auth.membershipId,
              campaignId: row.campaignId,
              campaignProspectId: row.campaignProspectId,
            });
            const reservation = await this.reservationRepository.findCurrent(
              auth.tenantId,
              row.campaignId,
              row.campaignProspectId,
            );
            if (
              !reservation ||
              reservation.reservationId !== row.reservationId ||
              reservation.assignmentId !== row.assignmentId ||
              reservation.userId !== auth.membershipId
            )
              throw new ConflictException(
                'The action reservation expired or changed; cancel and start a new action',
              );
            await tx.insert(prospectActivities).values({
              tenantId: auth.tenantId,
              campaignId: row.campaignId,
              campaignProspectId: row.campaignProspectId,
              establishmentId: row.establishmentId,
              assignmentId: row.assignmentId,
              userId: auth.membershipId,
              reservationId: row.reservationId!,
              type: row.type as 'call' | 'email' | 'message' | 'visit',
            });
          }
          const [outcome] = await tx
            .insert(actionOutcomes)
            .values({
              tenantId: auth.tenantId,
              actionId: row.id,
              outcomeCode: complete.outcomeCode,
              notes: complete.notes,
              recordedBy: auth.membershipId,
            })
            .returning();
          evidence.outcome = outcome;
          if (complete.contactUpdate) {
            const update = complete.contactUpdate;
            const [before] = await tx
              .select()
              .from(establishmentContacts)
              .where(
                and(
                  eq(establishmentContacts.tenantId, auth.tenantId),
                  eq(establishmentContacts.establishmentId, row.establishmentId),
                  eq(establishmentContacts.id, update.contactId),
                ),
              )
              .for('update');
            if (!before) throw new NotFoundException('Contact not found for this prospect');
            const [after] = await tx
              .update(establishmentContacts)
              .set({ name: update.name, email: update.email, phone: update.phone, updatedAt: now })
              .where(eq(establishmentContacts.id, before.id))
              .returning();
            evidence.contact = { before, after };
          }
          if (complete.lifecycleStage) {
            await tx
              .update(campaignProspects)
              .set({ lifecycleStage: complete.lifecycleStage, updatedAt: now })
              .where(eq(campaignProspects.id, row.campaignProspectId));
            evidence.prospectStatus = {
              before: cp!.lifecycleStage,
              after: complete.lifecycleStage,
            };
          }
          if (definition.behavior === 'do_not_contact') {
            const [consent] = await tx
              .insert(contactConsents)
              .values({
                tenantId: auth.tenantId,
                prospectId: row.establishmentId,
                channel: 'all',
                status: 'blocked',
                reason: complete.notes?.trim() || 'Opposition recorded during action completion',
                evidence: { actionId: row.id },
                recordedBy: auth.membershipId,
              })
              .returning();
            evidence.consent = consent;
            await tx.insert(auditEvents).values({
              tenantId: auth.tenantId,
              actorType: 'user',
              actorUserId: auth.membershipId,
              resourceType: 'prospect',
              resourceId: row.establishmentId,
              action: 'prospect.consent_recorded',
              metadata: { after: consent },
            });
          }
          if (complete.nextFollowUp) {
            const [followUp] = await tx
              .insert(prospectFollowUps)
              .values({
                tenantId: auth.tenantId,
                campaignId: row.campaignId,
                campaignProspectId: row.campaignProspectId,
                establishmentId: row.establishmentId,
                assignmentId: row.assignmentId,
                createdBy: auth.membershipId,
                assignedUserId: row.assigneeMembershipId,
                dueAt: new Date(complete.nextFollowUp.dueAt),
                channel: complete.nextFollowUp.channel ?? null,
              })
              .returning();
            evidence.followUpId = followUp!.id;
            await tx.insert(actionEffects).values({
              tenantId: auth.tenantId,
              actionId: row.id,
              type: 'schedule_follow_up',
              payload: {
                followUpId: followUp!.id,
                campaignId: row.campaignId,
                campaignProspectId: row.campaignProspectId,
                dueAt: followUp!.dueAt.toISOString(),
              },
            });
          }
          if (complete.reservationDisposition === 'release' && row.reservationId)
            await this.releaseEffect(row, campaign!.organizationId, tx);
          evidence.reservationDisposition = complete.reservationDisposition;
          values.status = 'completed';
          values.completedAt = now;
        }
        const [after] = await tx
          .update(actions)
          .set(values)
          .where(eq(actions.id, row.id))
          .returning();
        await this.event(auth, after!, operation, { ...evidence, after }, tx);
        return after!;
      });
    } catch (error) {
      rethrowConsentBlock(error);
      throw error;
    }
  }
  private async releaseEffect(
    row: typeof actions.$inferSelect,
    organizationId: string,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(actionEffects).values({
      tenantId: row.tenantId,
      actionId: row.id,
      type: 'release_reservation',
      payload: {
        campaignId: row.campaignId,
        campaignProspectId: row.campaignProspectId,
        establishmentId: row.establishmentId,
        organizationId,
        reservationId: row.reservationId!,
      },
    });
  }
  private async event(
    auth: AuthenticatedPrincipal,
    row: typeof actions.$inferSelect,
    eventType: string,
    data: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(actionEvents).values({
      tenantId: auth.tenantId,
      actionId: row.id,
      eventType,
      actorMembershipId: auth.membershipId,
      data,
    });
    await tx.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      resourceType: 'action',
      resourceId: row.id,
      action: `action.${eventType}`,
      metadata: data,
    });
  }
}
