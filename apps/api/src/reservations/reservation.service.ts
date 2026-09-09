import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ReservationRepository } from './reservation.repository.js';
import type { ProspectReservation } from './reservation.types.js';

const RESERVATION_TTL_SECONDS = 20 * 60;

export interface AcquireReservationInput {
  tenantId: string;
  userId: string;

  campaignId: string;
  campaignProspectId: string;
}

export interface ReservationEligibilityContext {
  assignment: CampaignProspectAssignment;
  establishmentId: string;
}

export interface ReleaseReservationInput extends AcquireReservationInput {
  reservationId: string;
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly campaignProspectRepository: CampaignProspectRepository,

    private readonly teamRepository: TeamRepository,

    private readonly userRepository: UserRepository,

    private readonly authorizationService: AuthorizationService,

    private readonly coolingOffService: CoolingOffService,

    private readonly followUpRepository: ProspectFollowUpRepository,

    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly coordinationCollisionPolicyService: CoordinationCollisionPolicyService,

    private readonly reservationCoordinationScopeService: ReservationCoordinationScopeService,
  ) {}

  async acquire(input: AcquireReservationInput): Promise<ProspectReservation> {
    const { assignment, establishmentId } = await this.requireReservationEligibility(input);

    const targetOrganizationId = assignment.organizationId;

    /*
     * Priority 1:
     * Exact campaign-prospect reservation.
     *
     * This is checked before every collision rule
     * so an idempotent retry by the existing owner
     * can continue even if another activity or
     * follow-up was created afterward.
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
        return currentExact;
      }

      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * Determine which organizations participate
     * in reservation mutual exclusion.
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
     * Temporary TR-016 compatibility check.
     *
     * Existing reservations created before the
     * organization-scoped Redis model may still
     * have the old tenant-wide collision key for
     * up to the reservation TTL.
     *
     * Do not ignore that lock during migration.
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
      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * Priority 2:
     * ACTIVE_RESERVATION
     *
     * Query only organizations that participate
     * in the target organization's coordination
     * scope.
     *
     * Independent organizations are intentionally
     * absent from this list.
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
     * Priority 3:
     * PLANNED_ACTION
     *
     * Evaluate every pending follow-up.
     *
     * An independent organization's follow-up is
     * ignored, but it must not hide another
     * applicable follow-up.
     */
    let followUpCandidates;

    try {
      followUpCandidates =
        await this.followUpRepository.findConflictingPendingCandidatesByEstablishment(
          input.tenantId,
          establishmentId,
          input.campaignId,
          input.campaignProspectId,
          input.userId,
        );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    for (const followUp of followUpCandidates) {
      let coordination;

      try {
        coordination = await this.coordinationCollisionPolicyService.evaluate({
          tenantId: input.tenantId,

          targetOrganizationId,

          conflictingOrganizationId: followUp.organizationId,

          collisionType: 'planned_action',
        });
      } catch {
        throw new ServiceUnavailableException('Reservation service is unavailable');
      }

      if (coordination.action === 'ignore') {
        continue;
      }

      throw new ConflictException('Establishment has a planned action');
    }

    /*
     * Priority 4:
     * RECENT_CONTACT
     *
     * Activities must also be evaluated
     * individually because policy may differ
     * between organizations.
     */
    let activityCandidates;

    try {
      activityCandidates = await this.prospectActivityRepository.findCandidatesByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    const now = new Date();

    for (const activity of activityCandidates) {
      let coordination;

      try {
        coordination = await this.coordinationCollisionPolicyService.evaluate({
          tenantId: input.tenantId,

          targetOrganizationId,

          conflictingOrganizationId: activity.organizationId,

          collisionType: 'recent_contact',
        });
      } catch {
        throw new ServiceUnavailableException('Reservation service is unavailable');
      }

      if (coordination.action === 'ignore') {
        continue;
      }

      let coolingOff;

      if (coordination.action === 'delayed') {
        /*
         * The database constraint requires a
         * positive delay for DELAYED policies,
         * but keep a defensive runtime guard.
         */
        if (coordination.delayMinutes === null || coordination.delayMinutes <= 0) {
          throw new ServiceUnavailableException('Reservation service is unavailable');
        }

        coolingOff = this.coolingOffService.evaluateActivity(
          activity,
          now,
          coordination.delayMinutes,
        );
      } else {
        coolingOff = this.coolingOffService.evaluateActivity(activity, now);
      }

      if (coolingOff.active) {
        throw new ConflictException('Establishment is in cooling-off period');
      }
    }

    /*
     * Priority 5:
     * ACTIVE_ASSIGNMENT
     *
     * SHARED / DELAYED assignments remain advisory
     * and therefore do not prevent reservation.
     *
     * COORDINATED assignment ownership is a hard
     * reservation boundary.
     *
     * INDEPENDENT assignments are ignored.
     */
    let assignmentCandidates;

    try {
      assignmentCandidates =
        await this.assignmentRepository.findConflictingCurrentCandidatesByEstablishment(
          input.tenantId,
          establishmentId,
          input.campaignId,
          input.campaignProspectId,
        );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    for (const conflictingAssignment of assignmentCandidates) {
      let coordination;

      try {
        coordination = await this.coordinationCollisionPolicyService.evaluate({
          tenantId: input.tenantId,

          targetOrganizationId,

          conflictingOrganizationId: conflictingAssignment.organizationId,

          collisionType: 'active_assignment',
        });
      } catch {
        throw new ServiceUnavailableException('Reservation service is unavailable');
      }

      if (coordination.action === 'ignore' || coordination.action === 'warn') {
        continue;
      }

      if (coordination.action === 'block') {
        throw new ConflictException('Establishment is assigned to a coordinated organization');
      }
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);

    const reservation: ProspectReservation = {
      reservationId: randomUUID(),

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
     * Priority 6:
     * Authoritative atomic Redis acquisition.
     *
     * Redis checks every establishment lock in the
     * blocking organization scope inside one Lua
     * execution.
     *
     * This protects against the race between the
     * PostgreSQL pre-checks above and simultaneous
     * reservation requests.
     */
    try {
      const acquired = await this.reservationRepository.acquireWithinOrganizationScope(
        reservation,
        blockingOrganizationIds,
        RESERVATION_TTL_SECONDS,
      );

      if (acquired) {
        return reservation;
      }

      /*
       * Another request may have won the atomic
       * acquisition.
       *
       * Re-check the exact campaign prospect so a
       * concurrent retry from the same owner remains
       * idempotent.
       */
      const current = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );

      if (current && this.isIdempotentReservation(current, input, assignment.id)) {
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

  async getCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<ProspectReservation | null> {
    await this.requireCampaignProspect(tenantId, campaignId, campaignProspectId);

    try {
      return await this.reservationRepository.findCurrent(tenantId, campaignId, campaignProspectId);
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }
  }

  async release(input: ReleaseReservationInput): Promise<{
    released: true;
    reservationId: string;
  }> {
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
     * Manager override remains deferred to TR-022.
     */
    if (current.userId !== input.userId) {
      throw new ForbiddenException('Reservation belongs to another user');
    }

    if (current.reservationId !== input.reservationId) {
      throw new ConflictException('Reservation has changed');
    }

    /*
     * During the TR-016 -> TR-017 transition an
     * existing reservation may still own the
     * legacy tenant-wide collision key.
     *
     * If that exact legacy lock belongs to this
     * reservation, release using the old atomic
     * path. Otherwise release the new
     * organization-scoped lock.
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

      if (!released) {
        throw new ConflictException('Reservation has changed or expired');
      }
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    return {
      released: true,

      reservationId: input.reservationId,
    };
  }

  async requireReservationEligibility(
    input: AcquireReservationInput,
  ): Promise<ReservationEligibilityContext> {
    const campaign = await this.campaignRepository.findById(input.tenantId, input.campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    /*
     * Assignment may exist during draft/paused,
     * but prospecting requires an active campaign.
     */
    if (campaign.status !== 'active') {
      throw new ConflictException('Campaign is not active');
    }

    const prospect = await this.campaignProspectRepository.findById(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    if (prospect.status !== 'active') {
      throw new ConflictException('Campaign prospect is not active');
    }

    const assignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!assignment) {
      throw new ConflictException('Campaign prospect is not assigned');
    }

    const team = await this.teamRepository.findById(input.tenantId, assignment.teamId);

    if (!team) {
      throw new NotFoundException('Assigned team not found');
    }

    if (team.status !== 'active') {
      throw new ConflictException('Assigned team is not active');
    }

    const user = await this.userRepository.findById(input.tenantId, input.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('User is not active');
    }

    /*
     * Individual ownership remains authoritative.
     */
    if (assignment.assignedUserId && assignment.assignedUserId !== input.userId) {
      throw new ForbiddenException('Campaign prospect is assigned to another user');
    }

    /*
     * Even an individually assigned user must
     * retain the exact team-level prospector grant.
     */
    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    const isExactTeamProspector = grants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId === assignment.organizationId &&
        grant.teamId === assignment.teamId,
    );

    if (!isExactTeamProspector) {
      throw new ForbiddenException('User is not a prospector for the assigned team');
    }

    return {
      assignment,

      establishmentId: prospect.establishmentId,
    };
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
}
