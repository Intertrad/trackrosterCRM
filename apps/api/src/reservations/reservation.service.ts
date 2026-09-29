import { ReservationPolicyService } from './reservation-policy.service.js';
import { ReservationLedgerService } from './reservation-ledger.service.js';
import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ProspectReservation, ProspectReservationState } from './reservation.types.js';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { CollisionBusinessDecisionService } from '../collisions/collision-business-decision.service.js';
import {
  buildCollisionOverrideConflictKey,
  isOverrideableCollisionReason,
} from '../collisions/collision-override-key.js';
import { CollisionOverrideRepository } from '../collisions/collision-override.repository.js';
import type { CollisionDecisionResult } from '../collisions/collision.types.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ReservationExpirySchedulerService } from './reservation-expiry-scheduler.service.js';
import { ReservationRepository } from './reservation.repository.js';

export interface AcquireReservationInput {
  tenantId: string;
  userId: string;

  campaignId: string;
  campaignProspectId: string;

  /*
   * Optional reference to a server-issued manager
   * override.
   *
   * The presence of an ID does NOT itself authorize
   * anything. The record is revalidated against the
   * exact current collision before reservation
   * acquisition.
   */
  overrideId?: string;
}

export interface ReservationEligibilityContext {
  assignment: CampaignProspectAssignment;
  establishmentId: string;
}

export interface ReleaseReservationInput {
  tenantId: string;
  userId: string;

  campaignId: string;
  campaignProspectId: string;

  reservationId: string;
}

export interface GetCurrentReservationInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly reservationRepository: ReservationRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly campaignProspectRepository: CampaignProspectRepository,

    private readonly teamRepository: TeamRepository,

    private readonly userRepository: UserRepository,

    private readonly authorizationService: AuthorizationService,

    private readonly collisionBusinessDecisionService: CollisionBusinessDecisionService,

    private readonly collisionOverrideRepository: CollisionOverrideRepository,

    private readonly reservationCoordinationScopeService: ReservationCoordinationScopeService,

    private readonly reservationExpirySchedulerService: ReservationExpirySchedulerService,
    private readonly rules?: ReservationPolicyService,
    private readonly ledger?: ReservationLedgerService,
  ) {}

  async acquire(input: AcquireReservationInput): Promise<ProspectReservation> {
    /*
     * First establish authoritative target context.
     *
     * This validates:
     *
     * - active campaign
     * - active campaign prospect
     * - current assignment
     * - active team
     * - active user
     * - individual ownership
     * - exact team-level prospector grant
     */
    const { assignment, establishmentId } = await this.requireReservationEligibility(input);

    const targetOrganizationId = assignment.organizationId;
    const rule = await this.rules?.resolve(input.tenantId, input.campaignId);
    const ttlSeconds = (rule?.durationMinutes ?? 20) * 60;

    /*
     * Priority 1A:
     * Exact campaign-prospect reservation.
     *
     * This remains ahead of every collision rule so
     * an idempotent retry by the existing owner can
     * return the already-acquired reservation.
     */
    let currentExact: ProspectReservation | null;

    try {
      currentExact = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (currentExact) {
      if (this.isIdempotentReservation(currentExact, input, assignment.id)) {
        await this.scheduleExpiryBestEffort(currentExact);

        return currentExact;
      }

      /*
       * Manager overrides NEVER bypass an already
       * active reservation owned by another request.
       */
      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * Determine which organizations participate in
     * reservation mutual exclusion.
     *
     * SAME / SHARED / COORDINATED / DELAYED
     * are included.
     *
     * INDEPENDENT is excluded.
     */
    let blockingOrganizationIds: string[];

    try {
      const scope = await this.reservationCoordinationScopeService.resolve(
        input.tenantId,
        targetOrganizationId,
      );

      blockingOrganizationIds = scope.blockingOrganizationIds;
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    /*
     * Priority 1B:
     * Legacy TR-016 tenant-wide reservation
     * compatibility.
     *
     * Existing legacy locks remain authoritative
     * until their Redis TTL expires.
     */
    let legacyReservation: ProspectReservation | null;

    try {
      legacyReservation = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (legacyReservation) {
      /*
       * This is also non-overrideable.
       */
      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * Priority 1C:
     * Organization-aware ACTIVE_RESERVATION.
     *
     * Manager approval may override a persisted
     * business policy collision, but never a live
     * reservation lock.
     */
    let reservationCandidates: ProspectReservation[];

    try {
      reservationCandidates = await this.reservationRepository.findCurrentCandidatesByOrganizations(
        input.tenantId,
        establishmentId,
        blockingOrganizationIds,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (reservationCandidates.length > 0) {
      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * Persisted business collision evaluation.
     *
     * Both manager-override creation and reservation
     * consumption use the same canonical evaluator.
     *
     * This prevents the two workflows from selecting
     * different follow-ups, activities or assignments
     * for the same collision.
     */
    const businessCollision = await this.collisionBusinessDecisionService.evaluate({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,

      establishmentId,

      targetOrganizationId,
    });

    if (businessCollision.decision === 'block') {
      if (input.overrideId && rule?.allowManagerOverride === false)
        throw new ConflictException('Reservation policy does not allow manager exceptions');
      /*
       * The shared business evaluator should only
       * produce hard blocks for collision types that
       * TR-022 explicitly allows a manager to
       * override.
       *
       * Keep this defensive check so a future reason
       * cannot accidentally become overrideable.
       */
      if (
        !isOverrideableCollisionReason(businessCollision.reasonCode) ||
        !businessCollision.conflict
      ) {
        throw new ServiceUnavailableException('Collision context is invalid');
      }

      /*
       * Ordinary reservation path.
       *
       * Preserve the existing business-specific
       * conflict response when no manager override
       * was supplied.
       */
      if (!input.overrideId) {
        this.throwBusinessCollision(businessCollision.reasonCode);
      }

      /*
       * An override ID is only a reference.
       *
       * Revalidate:
       *
       * - tenant
       * - campaign
       * - campaign prospect
       * - prospector
       * - expiration
       * - canonical establishment
       * - current assignment
       * - organization
       * - team
       * - collision reason
       * - exact collision fingerprint
       */
      await this.requireValidCollisionOverride({
        tenantId: input.tenantId,

        userId: input.userId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        overrideId: input.overrideId,

        establishmentId,

        assignmentId: assignment.id,

        organizationId: assignment.organizationId,

        teamId: assignment.teamId,

        collision: businessCollision,
      });
    } else if (input.overrideId) {
      /*
       * Never let an old approval become a generic
       * privileged reservation token.
       *
       * If the approved hard collision disappeared
       * or became advisory, this approval no longer
       * applies.
       */
      throw new ConflictException('Collision override is no longer applicable');
    }

    /*
     * Reservation timestamps are generated only
     * after every eligibility and collision check
     * succeeds.
     */
    const now = new Date();

    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const reservation: ProspectReservation = {
      reservationId: randomUUID(),
      ...(input.overrideId ? { overrideId: input.overrideId } : {}),

      tenantId: input.tenantId,

      organizationId: targetOrganizationId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,

      establishmentId,

      assignmentId: assignment.id,

      teamId: assignment.teamId,

      userId: input.userId,

      acquiredAt: now.toISOString(),

      expiresAt: expiresAt.toISOString(),
    };

    /*
     * Final authoritative concurrency boundary.
     *
     * Even after a valid manager override, Redis
     * checks:
     *
     * - exact campaign-prospect reservation key
     * - target organization's establishment lock
     * - every blocking organization's establishment
     *   lock
     *
     * atomically in one Lua execution.
     *
     * Therefore manager override can never authorize
     * two simultaneous conflicting reservations.
     */
    try {
      await this.ledger?.prepare(reservation, rule ?? {});
      const acquired = await this.reservationRepository.acquireWithinOrganizationScope(
        reservation,
        blockingOrganizationIds,
        ttlSeconds,
      );

      if (acquired) {
        await this.ledger?.confirm(reservation);
        await this.scheduleExpiryBestEffort(reservation);

        return reservation;
      }

      /*
       * Another request may have won the atomic
       * acquisition between our earlier checks and
       * this Redis command.
       *
       * Re-check exact reservation so an idempotent
       * retry from the same owner can still succeed.
       */
      await this.ledger?.close(
        input.tenantId,
        reservation.reservationId,
        'failed',
        'Atomic claim did not acquire the lock',
      );
      const current = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );

      if (current && this.isIdempotentReservation(current, input, assignment.id)) {
        await this.scheduleExpiryBestEffort(current);

        return current;
      }

      throw new ConflictException('Campaign prospect is currently reserved');
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new ServiceUnavailableException('Reservation service is unavailable');
    }
  }
  async validateRenewal(current: ProspectReservation) {
    const context = await this.requireReservationEligibility({
      tenantId: current.tenantId,
      userId: current.userId,
      campaignId: current.campaignId,
      campaignProspectId: current.campaignProspectId,
    });
    if (context.assignment.id !== current.assignmentId)
      throw new ConflictException('Reservation assignment changed');
    const policy = await this.rules?.resolve(current.tenantId, current.campaignId);
    const collision = await this.collisionBusinessDecisionService.evaluate({
      tenantId: current.tenantId,
      userId: current.userId,
      campaignId: current.campaignId,
      campaignProspectId: current.campaignProspectId,
      establishmentId: current.establishmentId,
      targetOrganizationId: current.organizationId,
    });
    if (collision.decision === 'block' || collision.decision === 'require_override') {
      if (!current.overrideId || policy?.allowManagerOverride === false)
        throw new ConflictException('Current collision blocks renewal');
      await this.requireValidCollisionOverride({
        tenantId: current.tenantId,
        userId: current.userId,
        campaignId: current.campaignId,
        campaignProspectId: current.campaignProspectId,
        overrideId: current.overrideId,
        establishmentId: current.establishmentId,
        assignmentId: current.assignmentId,
        organizationId: current.organizationId,
        teamId: current.teamId,
        collision,
      });
    }
    return this.reservationCoordinationScopeService.resolve(
      current.tenantId,
      current.organizationId,
    );
  }
  async getCurrent(input: GetCurrentReservationInput): Promise<ProspectReservationState> {
    /*
     * Reading reservation state is still an
     * operational prospect action.
     *
     * Reuse the same authorization boundary as
     * acquisition so out-of-scope users cannot use
     * this endpoint as a resource-existence oracle.
     */
    const { assignment } = await this.requireReservationEligibility({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    let reservation: ProspectReservation | null;

    try {
      reservation = await this.reservationRepository.findCurrent(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (!reservation) {
      return {
        state: 'none',
      };
    }

    /*
     * Only expose reservation identity when the
     * authenticated prospector owns the reservation
     * for the exact current assignment.
     *
     * This prevents stale reassignment state and
     * another eligible team prospector's reservation
     * metadata from leaking through the read API.
     */
    if (reservation.userId === input.userId && reservation.assignmentId === assignment.id) {
      return {
        state: 'owned',

        reservationId: reservation.reservationId,

        acquiredAt: reservation.acquiredAt,

        expiresAt: reservation.expiresAt,
      };
    }

    /*
     * Another eligible prospector owns the Redis lock,
     * or the lock belongs to stale assignment context.
     *
     * The caller only needs the blocking expiry.
     */
    return {
      state: 'reserved',

      expiresAt: reservation.expiresAt,
    };
  }

  async release(input: ReleaseReservationInput): Promise<{
    released: true;
    reservationId: string;
  }> {
    /*
     * Releasing a reservation is an operational
     * prospect mutation.
     *
     * Authorize the caller before reading Redis so
     * this endpoint cannot reveal whether another
     * prospect has an active reservation.
     */
    await this.requireReservationEligibility({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    let current: ProspectReservation | null;

    try {
      current = await this.reservationRepository.findCurrent(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (!current) {
      throw new NotFoundException('Reservation not found');
    }

    /*
     * Defense in depth.
     *
     * requireReservationEligibility() already proves
     * the caller owns the current prospect workflow,
     * but the reservation may be stale or may have
     * been created before reassignment.
     *
     * Do not expose that another user's reservation
     * exists.
     */
    if (current.userId !== input.userId) {
      throw new NotFoundException('Reservation not found');
    }

    /*
     * At this point the caller is authorized for the
     * prospect and owns the current reservation, so
     * exposing that the submitted reservation ID is
     * stale is safe.
     */
    if (current.reservationId !== input.reservationId) {
      throw new ConflictException('Reservation has changed');
    }

    /*
     * During the TR-016 -> TR-017 transition an
     * existing reservation may still own the legacy
     * tenant-wide collision key.
     *
     * If that exact legacy lock belongs to this
     * reservation, release using the old atomic path.
     * Otherwise release the organization-scoped lock.
     */
    let legacyReservation: ProspectReservation | null;

    try {
      legacyReservation = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,

        current.establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    try {
      let released: boolean;

      if (legacyReservation?.reservationId === current.reservationId) {
        released = await this.reservationRepository.release(
          input.tenantId,

          input.campaignId,

          input.campaignProspectId,

          current.establishmentId,

          input.reservationId,
        );
      } else {
        released = await this.reservationRepository.releaseOrganizationScoped(
          input.tenantId,

          input.campaignId,

          input.campaignProspectId,

          current.organizationId,

          current.establishmentId,

          input.reservationId,
        );
      }

      /*
       * The reservation may have changed between the
       * read and atomic release operation.
       */
      if (!released) {
        throw new ConflictException('Reservation has changed');
      }

      await this.ledger?.close(
        input.tenantId,
        input.reservationId,
        'released',
        'Owner released reservation',
      );
      return {
        released: true,

        reservationId: input.reservationId,
      };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new ServiceUnavailableException('Reservation service is unavailable');
    }
  }

  async resolveReservationTargetScope(input: {
    tenantId: string;

    campaignId: string;

    campaignProspectId: string;
  }): Promise<ReservationEligibilityContext> {
    /*
     * This method resolves only enough information
     * to determine the target organization/team.
     *
     * It deliberately does NOT expose campaign,
     * prospect or team workflow state.
     *
     * Missing campaign, prospect and assignment all
     * share the same response so an override-capable
     * caller cannot use this resolver as an
     * existence/state oracle.
     */
    const campaign = await this.campaignRepository.findById(input.tenantId, input.campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const assignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!assignment) {
      throw new NotFoundException('Campaign prospect not found');
    }

    return {
      assignment,

      establishmentId: prospect.establishmentId,
    };
  }

  /*
   * Shared eligibility boundary used by:
   *
   * - reservation acquisition
   * - collision decision evaluation
   * - manager override creation
   *
   * This means all three workflows resolve the
   * target prospect through the same ownership and
   * authorization rules.
   */
  async requireReservationEligibility(
    input: AcquireReservationInput,
  ): Promise<ReservationEligibilityContext> {
    /*
     * Validate the authenticated principal before
     * resolving any requested campaign/prospect IDs.
     *
     * A missing authenticated user is treated the
     * same as an inactive principal. The target
     * resource must not become an existence oracle.
     */
    const user = await this.userRepository.findById(input.tenantId, input.userId);

    if (!user || user.status !== 'active') {
      throw new ForbiddenException('User is not active');
    }

    /*
     * Coarse authorization comes before target
     * resolution.
     *
     * Users with no prospector team scope at all
     * cannot probe campaign/prospect identifiers.
     */
    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    const hasProspectorTeamScope = grants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId !== null &&
        grant.teamId !== null,
    );

    if (!hasProspectorTeamScope) {
      throw new ForbiddenException('User does not have a prospector team scope');
    }

    const campaign = await this.campaignRepository.findById(input.tenantId, input.campaignId);

    /*
     * Missing and unauthorized targets deliberately
     * share one public response.
     */
    if (!campaign) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const assignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    /*
     * An unassigned prospect is not an operational
     * prospecting resource for this workflow.
     *
     * Mask it exactly like a missing prospect.
     */
    if (!assignment) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * Individual assignment ownership remains
     * authoritative.
     *
     * Do not reveal that another user's assignment
     * exists.
     */
    if (assignment.status === 'paused') throw new ConflictException('Assignment is paused');

    if (assignment.assignedUserId && assignment.assignedUserId !== input.userId) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * The caller must possess the exact team-level
     * prospector grant for the current assignment.
     *
     * A user who has some other prospector grant must
     * not be able to distinguish an out-of-scope
     * prospect from a nonexistent one.
     */
    const isExactTeamProspector = grants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId === assignment.organizationId &&
        grant.teamId === assignment.teamId,
    );

    if (!isExactTeamProspector) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * Exact authorization is now proven.
     *
     * From this point onward it is safe to expose
     * meaningful workflow-state conflicts to the
     * legitimate prospector.
     */
    if (campaign.status !== 'active') {
      throw new ConflictException('Campaign is not active');
    }

    if (prospect.status !== 'active') {
      throw new ConflictException('Campaign prospect is not active');
    }

    const team = await this.teamRepository.findById(input.tenantId, assignment.teamId);

    if (!team) {
      throw new NotFoundException('Assigned team not found');
    }

    if (team.status !== 'active') {
      throw new ConflictException('Assigned team is not active');
    }

    return {
      assignment,

      establishmentId: prospect.establishmentId,
    };
  }

  /*
   * Validate a previously-created manager approval
   * against the exact collision that exists NOW.
   */
  private async requireValidCollisionOverride(input: {
    tenantId: string;

    userId: string;

    campaignId: string;

    campaignProspectId: string;

    overrideId: string;

    establishmentId: string;

    assignmentId: string;

    organizationId: string;

    teamId: string;

    collision: CollisionDecisionResult;
  }): Promise<void> {
    /*
     * Only hard persisted business collisions may
     * reach this validation path.
     */
    if (
      input.collision.decision !== 'block' ||
      !input.collision.conflict ||
      !isOverrideableCollisionReason(input.collision.reasonCode)
    ) {
      throw new ServiceUnavailableException('Collision context is incomplete');
    }

    let overrideRecord;

    try {
      overrideRecord = await this.collisionOverrideRepository.findApplicableById({
        tenantId: input.tenantId,

        overrideId: input.overrideId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        prospectorUserId: input.userId,

        now: new Date(),
      });
    } catch {
      throw new ServiceUnavailableException('Collision override service is unavailable');
    }

    /*
     * findApplicableById already enforces:
     *
     * - same tenant
     * - same override ID
     * - same campaign
     * - same campaign prospect
     * - same prospector
     * - expiresAt > now
     */
    if (!overrideRecord) {
      throw new ConflictException('Collision override is invalid or expired');
    }

    /*
     * Bind the approval to the canonical target
     * context existing when the manager approved it.
     *
     * Reassignment, team transfer, organization
     * change or establishment mismatch invalidates
     * the approval.
     */
    if (
      overrideRecord.establishmentId !== input.establishmentId ||
      overrideRecord.assignmentId !== input.assignmentId ||
      overrideRecord.organizationId !== input.organizationId ||
      overrideRecord.teamId !== input.teamId
    ) {
      throw new ConflictException('Collision override does not match current prospect context');
    }

    /*
     * An approval for one business collision type
     * cannot be reused for another.
     */
    if (overrideRecord.reasonCode !== input.collision.reasonCode) {
      throw new ConflictException('Collision override does not match current collision');
    }

    let currentConflictKey: string;

    try {
      currentConflictKey = buildCollisionOverrideConflictKey(input.collision);
    } catch {
      throw new ServiceUnavailableException('Collision context is invalid');
    }

    /*
     * Critical stale-approval check.
     *
     * Examples:
     *
     * planned_action:<followUpId>:<dueAt>
     *
     * recent_contact:<activityId>:<expiresAt>
     *
     * active_assignment:<assignmentId>:<assignedAt>
     *
     * If the underlying business collision changes,
     * the key changes and the approval is rejected.
     */
    if (overrideRecord.conflictKey !== currentConflictKey) {
      throw new ConflictException('Collision override is stale');
    }
  }

  /*
   * Preserve the existing reservation API's
   * business-specific conflict semantics when no
   * override has been supplied.
   */
  private throwBusinessCollision(
    reasonCode: 'PLANNED_ACTION' | 'RECENT_CONTACT' | 'ACTIVE_ASSIGNMENT',
  ): never {
    switch (reasonCode) {
      case 'PLANNED_ACTION':
        throw new ConflictException('Establishment has a planned action');

      case 'RECENT_CONTACT':
        throw new ConflictException('Establishment is in cooling-off period');

      case 'ACTIVE_ASSIGNMENT':
        throw new ConflictException('Establishment is assigned to a coordinated organization');
    }
  }

  private isIdempotentReservation(
    reservation: ProspectReservation,
    input: AcquireReservationInput,
    assignmentId: string,
  ): boolean {
    return (
      reservation.campaignId === input.campaignId &&
      reservation.campaignProspectId === input.campaignProspectId &&
      reservation.userId === input.userId &&
      reservation.assignmentId === assignmentId
    );
  }

  private async requireCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<void> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      tenantId,
      campaignId,
      campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }
  }

  private async scheduleExpiryBestEffort(reservation: ProspectReservation): Promise<void> {
    try {
      await this.reservationExpirySchedulerService.schedule(reservation);
    } catch (error: unknown) {
      /*
       * Redis TTL is authoritative.
       *
       * Failure to enqueue this secondary expiry job
       * must never invalidate an already-acquired
       * reservation.
       */
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        [
          'Reservation expiry job could not be scheduled',
          `reservationId=${reservation.reservationId}`,
          `tenantId=${reservation.tenantId}`,
          `error=${errorMessage}`,
        ].join(' '),
      );
    }
  }
}
