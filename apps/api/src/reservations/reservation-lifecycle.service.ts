import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  actionEffects,
  campaignProspectAssignments,
  reservationRecords,
  reservationEvents,
  tenants,
  tenantMemberships,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { prospectReadScope } from '../actions/action-access.js';
import { ReservationService } from './reservation.service.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationPolicyService } from './reservation-policy.service.js';
import { ReservationLedgerService } from './reservation-ledger.service.js';
import { ReservationExpirySchedulerService } from './reservation-expiry-scheduler.service.js';
import type { ClaimReservationDto, ReservationListDto } from './reservation-lifecycle.dto.js';
@Injectable()
export class ReservationLifecycleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reservations: ReservationService,
    private readonly repo: ReservationRepository,
    private readonly policy: ReservationPolicyService,
    private readonly ledger: ReservationLedgerService,
    private readonly scheduler: ReservationExpirySchedulerService,
  ) {}
  private async lock(a: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
    const [actor] = await tx
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, a.tenantId),
          eq(tenantMemberships.id, a.membershipId),
          eq(tenantMemberships.status, 'active'),
        ),
      )
      .for('key share');
    if (!actor) throw new ForbiddenException('Active membership required');
  }
  private async consent(a: AuthenticatedPrincipal, establishmentId: string) {
    const r = await this.db.execute<{ blocked: boolean }>(
      sql`SELECT trackroster_consent_blocked(${a.tenantId}::uuid,${establishmentId}::uuid,NULL) AS blocked`,
    );
    if (r.rows[0]?.blocked)
      throw new ConflictException({
        code: 'CONTACT_BLOCKED',
        message: 'Prospect opposition blocks reservation operations',
      });
  }
  async authorizeClaim(a: AuthenticatedPrincipal, input: ClaimReservationDto) {
    const context = await this.reservations.requireReservationEligibility({
      tenantId: a.tenantId,
      userId: a.membershipId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
    });
    await this.consent(a, context.establishmentId);
    return context;
  }
  async row(
    a: AuthenticatedPrincipal,
    id: string,
    ownerOnly = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const [row] = await tx
      .select()
      .from(reservationRecords)
      .where(
        and(
          eq(reservationRecords.tenantId, a.tenantId),
          eq(reservationRecords.id, id),
          ownerOnly
            ? eq(reservationRecords.ownerMembershipId, a.membershipId)
            : prospectReadScope(a, sql`${reservationRecords.campaignProspectId}`),
        ),
      );
    if (!row) throw new NotFoundException('Reservation not found');
    return row;
  }
  async authorizeMutation(
    a: AuthenticatedPrincipal,
    id: string,
    op: 'heartbeat' | 'extend' | 'release',
  ) {
    const row = await this.row(a, id, true);
    if (op === 'release') return row;
    const context = await this.authorizeClaim(a, row);
    if (context.assignment.id !== row.lease.assignmentId)
      throw new ConflictException('Assignment changed');
    const rule = await this.policy.resolve(a.tenantId, row.campaignId);
    if ((op === 'heartbeat' && !rule.allowHeartbeat) || (op === 'extend' && !rule.allowExtension))
      throw new ConflictException('Reservation policy prohibits this renewal');
    const [release] = await this.db
      .select({ id: actionEffects.id })
      .from(actionEffects)
      .where(
        and(
          eq(actionEffects.tenantId, a.tenantId),
          eq(actionEffects.type, 'release_reservation'),
          sql`${actionEffects.deliveredAt} IS NULL AND ${actionEffects.payload}->>'reservationId'=${id}`,
        ),
      )
      .limit(1);
    if (release) throw new ConflictException('Reservation release is pending');
    return row;
  }
  async claim(a: AuthenticatedPrincipal, input: ClaimReservationDto) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const c = await this.authorizeClaim(a, input);
      const [assignment] = await tx
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, a.tenantId),
            eq(campaignProspectAssignments.id, c.assignment.id),
            sql`${campaignProspectAssignments.endedAt} IS NULL`,
          ),
        )
        .for('update');
      if (!assignment) throw new ConflictException('Assignment changed');
      const lease = await this.reservations.acquire({
        tenantId: a.tenantId,
        userId: a.membershipId,
        campaignId: input.campaignId,
        campaignProspectId: input.campaignProspectId,
        overrideId: input.overrideId,
      });
      await this.ledger.observeLegacy(
        lease,
        await this.policy.resolve(a.tenantId, input.campaignId, tx),
      );
      await this.ledger.confirm(lease);
      return {
        claimToken: lease.reservationId,
        status: 'active',
        ...lease,
      };
    });
  }
  async detail(a: AuthenticatedPrincipal, id: string) {
    await this.row(a, id);
    const row = await this.ledger.refresh(a.tenantId, id);
    const events = await this.db
      .select()
      .from(reservationEvents)
      .where(
        and(eq(reservationEvents.tenantId, a.tenantId), eq(reservationEvents.reservationId, id)),
      )
      .orderBy(desc(reservationEvents.createdAt), desc(reservationEvents.id))
      .limit(50);
    return {
      ...row,
      claimToken: row?.ownerMembershipId === a.membershipId ? id : undefined,
      events,
    };
  }
  async list(a: AuthenticatedPrincipal, q: ReservationListDto) {
    const candidates = await this.db
      .select({ id: reservationRecords.id })
      .from(reservationRecords)
      .where(
        and(
          eq(reservationRecords.tenantId, a.tenantId),
          prospectReadScope(a, sql`${reservationRecords.campaignProspectId}`),
          q.campaignId ? eq(reservationRecords.campaignId, q.campaignId) : undefined,
          q.cursor ? gt(reservationRecords.id, q.cursor) : undefined,
        ),
      )
      .orderBy(reservationRecords.id)
      .limit(100);
    const items = [];
    let scanned = 0;
    for (const candidate of candidates) {
      scanned++;
      const r = await this.ledger.refresh(a.tenantId, candidate.id);
      if (r && (!q.status || r.status === q.status)) items.push(r);
      if (items.length === q.limit) break;
    }
    return {
      items,
      nextCursor:
        scanned > 0 && (scanned < candidates.length || candidates.length === 100)
          ? candidates[scanned - 1]!.id
          : null,
    };
  }
  async mutate(
    a: AuthenticatedPrincipal,
    id: string,
    op: 'heartbeat' | 'extend' | 'release',
    input: { minutes?: number; reason?: string },
  ) {
    return this.db.transaction(async (tx) => {
      await this.lock(a, tx);
      const row = await this.authorizeMutation(a, id, op);
      const current = await this.repo.findCurrent(
        a.tenantId,
        row.campaignId,
        row.campaignProspectId,
      );
      if (!current || current.reservationId !== id) {
        await this.ledger.refresh(a.tenantId, id);
        if (op === 'release' && row.status === 'released')
          return { reservationId: id, released: true };
        throw new ConflictException('Reservation expired, released or replaced');
      }
      if (current.userId !== a.membershipId) throw new NotFoundException('Reservation not found');
      if (op === 'release') {
        if (!input.reason || input.reason.trim().length < 3)
          throw new BadRequestException('Release reason required');
        await this.ledger.recordAttempt(a.tenantId, id, 'release', {
          actorMembershipId: a.membershipId,
          reason: input.reason.trim(),
        });
        const legacy = await this.repo.findCurrentByEstablishment(
          a.tenantId,
          current.establishmentId,
        );
        const released =
          legacy?.reservationId === id
            ? await this.repo.release(
                a.tenantId,
                current.campaignId,
                current.campaignProspectId,
                current.establishmentId,
                id,
              )
            : await this.repo.releaseOrganizationScoped(
                a.tenantId,
                current.campaignId,
                current.campaignProspectId,
                current.organizationId,
                current.establishmentId,
                id,
              );
        if (!released) throw new ConflictException('Reservation changed during release');
        await this.ledger.close(a.tenantId, id, 'released', input.reason.trim());
        return { reservationId: id, released: true };
      }
      const [assignment] = await tx
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, a.tenantId),
            eq(campaignProspectAssignments.id, current.assignmentId),
            sql`${campaignProspectAssignments.endedAt} IS NULL`,
          ),
        )
        .for('update');
      if (!assignment) throw new ConflictException('Assignment changed');
      const scope = await this.reservations.validateRenewal(current);
      const rule = await this.policy.resolve(a.tenantId, current.campaignId, tx);
      const originalMax =
        typeof row.ruleSnapshot.maxHoldMinutes === 'number' ? row.ruleSnapshot.maxHoldMinutes : 120;
      const cap =
        Date.parse(current.acquiredAt) + Math.min(originalMax, rule.maxHoldMinutes) * 60000;
      const target =
        op === 'heartbeat'
          ? Math.min(Date.now() + rule.durationMinutes * 60000, cap)
          : Date.parse(current.expiresAt) + (input.minutes ?? 0) * 60000;
      if (target > cap) throw new ConflictException('Requested extension exceeds maximum hold');
      if (target <= Date.parse(current.expiresAt)) {
        if (op === 'heartbeat' && Date.parse(current.expiresAt) < cap) return current;
        throw new ConflictException('Maximum reservation hold reached');
      }
      const next = { ...current, expiresAt: new Date(target).toISOString() };
      await this.ledger.recordAttempt(a.tenantId, id, op, {
        actorMembershipId: a.membershipId,
        previousExpiresAt: current.expiresAt,
        expiresAt: next.expiresAt,
      });
      if (!(await this.repo.renewOrganizationScoped(current, next, scope.blockingOrganizationIds)))
        throw new ConflictException(
          'Reservation or collision locks changed; renewal was not applied',
        );
      await this.ledger.confirm(
        next,
        op === 'heartbeat' ? 'heartbeat_confirmed' : 'extension_confirmed',
      );
      // Redis TTL plus ledger reconciliation remain correct even if the optional cleanup job is unavailable.
      try {
        await this.scheduler.schedule(next, true);
      } catch {
        /* Reconciliation retries independently. */
      }
      return next;
    });
  }
}
