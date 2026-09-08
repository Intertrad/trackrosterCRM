import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ReservationRepository } from './reservation.repository.js';
import type { ProspectReservation } from './reservation.types.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';

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
  ) {}

  async acquire(input: AcquireReservationInput): Promise<ProspectReservation> {
    const { assignment, establishmentId } = await this.requireReservationEligibility(input);

    /*
     * Check the canonical reservation first.
     *
     * This preserves idempotency if the caller
     * already owns this exact reservation, even
     * when they have recorded recent activity.
     */
    let currentCanonical: ProspectReservation | null;

    try {
      currentCanonical = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (currentCanonical) {
      const isExactTarget =
        currentCanonical.campaignId === input.campaignId &&
        currentCanonical.campaignProspectId === input.campaignProspectId;

      const isSameOwner = currentCanonical.userId === input.userId;

      const isSameAssignment = currentCanonical.assignmentId === assignment.id;

      if (isExactTarget && isSameOwner && isSameAssignment) {
        return currentCanonical;
      }

      throw new ConflictException('Campaign prospect is currently reserved');
    }

    /*
     * There is no active canonical reservation.
     *
     * Now check permanent activity history before
     * allowing a new work session.
     */
    const coolingOff = await this.coolingOffService.evaluate(input.tenantId, establishmentId);

    if (coolingOff.active) {
      throw new ConflictException('Establishment is in cooling-off period');
    }

    const now = new Date();

    const expiresAt = new Date(now.getTime() + RESERVATION_TTL_SECONDS * 1000);

    const reservation: ProspectReservation = {
      reservationId: randomUUID(),

      establishmentId,

      tenantId: input.tenantId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,

      assignmentId: assignment.id,

      teamId: assignment.teamId,

      userId: input.userId,

      acquiredAt: now.toISOString(),

      expiresAt: expiresAt.toISOString(),
    };

    try {
      const acquired = await this.reservationRepository.acquire(
        reservation,
        RESERVATION_TTL_SECONDS,
      );

      if (acquired) {
        return reservation;
      }

      /*
       * Another request may have acquired the
       * canonical lock between our pre-check and
       * the atomic Redis acquisition.
       *
       * Re-check the exact target so same-user
       * concurrent retries remain idempotent.
       */
      const current = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );

      if (current && current.userId === input.userId && current.assignmentId === assignment.id) {
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
     * Manager override is intentionally
     * deferred to a later ticket.
     */
    if (current.userId !== input.userId) {
      throw new ForbiddenException('Reservation belongs to another user');
    }

    if (current.reservationId !== input.reservationId) {
      throw new ConflictException('Reservation has changed');
    }

    try {
      const released = await this.reservationRepository.release(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
        current.establishmentId,
        input.reservationId,
      );

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
     * but actual prospecting requires ACTIVE.
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
     * If ownership is individual, only that
     * assigned user may acquire the reservation.
     */
    if (assignment.assignedUserId && assignment.assignedUserId !== input.userId) {
      throw new ForbiddenException('Campaign prospect is assigned to another user');
    }

    /*
     * Even individually assigned users must
     * still have their current team grant.
     *
     * This prevents a revoked prospector from
     * continuing to work using an old assignment.
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
