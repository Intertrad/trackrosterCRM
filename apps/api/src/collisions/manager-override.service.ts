import { ReservationPolicyService } from '../reservations/reservation-policy.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { CollisionOverride } from '../database/schema/collision-overrides.js';
import type { Database } from '../database/database.types.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { CollisionDecisionService } from './collision-decision.service.js';
import {
  buildCollisionOverrideConflictKey,
  isOverrideableCollisionReason,
} from './collision-override-key.js';
import { CollisionOverrideRepository } from './collision-override.repository.js';

const OVERRIDE_TTL_MINUTES = 10;

export interface CreateManagerOverrideInput {
  tenantId: string;

  approvedByUserId: string;

  prospectorUserId: string;

  campaignId: string;

  campaignProspectId: string;

  reason: string;
}

@Injectable()
export class ManagerOverrideService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly collisionDecisionService: CollisionDecisionService,

    private readonly collisionOverrideRepository: CollisionOverrideRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly authorizationService: AuthorizationService,

    private readonly reservationService: ReservationService,

    private readonly auditService: AuditService,
    private readonly reservationPolicy?: ReservationPolicyService,
  ) {}

  async create(input: CreateManagerOverrideInput): Promise<CollisionOverride> {
    const reason = input.reason.trim();

    /*
     * Keep the domain service defensive even though
     * DTO validation also protects the HTTP boundary.
     */
    if (reason.length < 10 || reason.length > 1000) {
      throw new BadRequestException('Override reason must be between 10 and 1000 characters');
    }

    /*
     * Coarse authorization must happen before any
     * requested campaign/prospect identifier is
     * resolved.
     */
    const hasAnyOverrideAuthority = await this.authorizationService.hasAnyOverrideAuthority(
      input.tenantId,

      input.approvedByUserId,
    );

    if (!hasAnyOverrideAuthority) {
      throw new ForbiddenException('User is not authorized to approve collision overrides');
    }

    /*
     * Resolve only enough target information to
     * determine organization/team authority.
     */
    const targetScope = await this.reservationService.resolveReservationTargetScope({
      tenantId: input.tenantId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    /*
     * Prove exact authority before exposing
     * prospector eligibility or collision state.
     */
    let authority = await this.authorizationService.getOverrideAuthority(
      input.tenantId,

      input.approvedByUserId,

      targetScope.assignment.organizationId,

      targetScope.assignment.teamId,
    );

    if (!authority) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * Full operational validation for the target
     * prospector.
     */
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.prospectorUserId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    /*
     * The target may have moved between masked scope
     * resolution and full eligibility validation.
     *
     * If so, reauthorize against the newer scope.
     */
    if (
      assignment.organizationId !== targetScope.assignment.organizationId ||
      assignment.teamId !== targetScope.assignment.teamId
    ) {
      authority = await this.authorizationService.getOverrideAuthority(
        input.tenantId,

        input.approvedByUserId,

        assignment.organizationId,

        assignment.teamId,
      );

      if (!authority) {
        throw new NotFoundException('Campaign prospect not found');
      }
    }

    if (
      (await this.reservationPolicy?.resolve(input.tenantId, input.campaignId))
        ?.allowManagerOverride === false
    )
      throw new ConflictException('Reservation policy does not allow manager exceptions');

    /*
     * Re-evaluate collision server-side.
     *
     * Never trust frontend collision state.
     */
    const collision = await this.collisionDecisionService.evaluate({
      tenantId: input.tenantId,

      userId: input.prospectorUserId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    /*
     * Both validation paths must refer to the same
     * canonical establishment.
     */
    if (collision.establishmentId !== establishmentId) {
      throw new ServiceUnavailableException('Collision context is inconsistent');
    }

    /*
     * Real-time reservation ownership is stronger
     * than any manager exception.
     */
    if (collision.reasonCode === 'ACTIVE_RESERVATION') {
      throw new ConflictException('Active reservation cannot be overridden');
    }

    /*
     * allow:
     *   no override required
     *
     * warn:
     *   advisory only; normal reservation flow may
     *   continue without manager authorization
     */
    if (collision.decision === 'allow' || collision.decision === 'warn') {
      throw new ConflictException('Current collision does not require an override');
    }

    const overrideReasonCode = collision.reasonCode;

    if (!isOverrideableCollisionReason(overrideReasonCode)) {
      throw new ConflictException('Current collision cannot be overridden');
    }

    if (!collision.conflict) {
      throw new ServiceUnavailableException('Collision context is incomplete');
    }

    let conflictKey: string;

    try {
      conflictKey = buildCollisionOverrideConflictKey(collision);
    } catch {
      throw new ServiceUnavailableException('Collision context is invalid');
    }

    const now = new Date();

    const expiresAt = new Date(now.getTime() + OVERRIDE_TTL_MINUTES * 60 * 1000);

    try {
      return await this.database.transaction(async (transaction) => {
        /*
         * Final assignment authority boundary.
         *
         * Everything above this point is
         * intentionally optimistic validation.
         *
         * Before persisting the privileged
         * approval, lock the current assignment
         * inside the SAME PostgreSQL transaction
         * that creates the override.
         *
         * A concurrent reassignment/unassignment
         * that already won causes this check to
         * fail.
         *
         * A concurrent reassignment that begins
         * after this lock must wait until this
         * transaction commits.
         */
        const lockedAssignment = await this.assignmentRepository.findCurrentForUpdate(
          input.tenantId,

          input.campaignId,

          input.campaignProspectId,

          transaction,
        );

        if (!lockedAssignment || lockedAssignment.id !== assignment.id) {
          throw new ConflictException('Campaign prospect changed during override approval');
        }

        const override = await this.collisionOverrideRepository.create(
          {
            tenantId: input.tenantId,

            campaignId: input.campaignId,

            campaignProspectId: input.campaignProspectId,

            establishmentId,

            /*
             * Use the transactionally locked
             * assignment rather than the
             * earlier optimistic snapshot.
             */
            assignmentId: lockedAssignment.id,

            organizationId: lockedAssignment.organizationId,

            teamId: lockedAssignment.teamId,

            prospectorUserId: input.prospectorUserId,

            approvedByUserId: input.approvedByUserId,

            approvedByRole: authority,

            reasonCode: overrideReasonCode,

            conflictKey,

            conflictSnapshot: {
              ...collision.conflict,
            },

            reason,

            expiresAt,
          },

          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,

            actorType: 'user',

            actorUserId: input.approvedByUserId,

            action: 'collision_override.approved',

            resourceType: 'collision_override',

            resourceId: override.id,

            metadata: {
              campaignId: override.campaignId,

              campaignProspectId: override.campaignProspectId,

              prospectorUserId: override.prospectorUserId,

              organizationId: override.organizationId,

              teamId: override.teamId,

              approvedByRole: override.approvedByRole,

              reasonCode: override.reasonCode,

              conflictKey: override.conflictKey,
            },
          },

          transaction,
        );

        return override;
      });
    } catch (error: unknown) {
      /*
       * A stale assignment is a legitimate domain
       * conflict, not an infrastructure failure.
       */
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new ServiceUnavailableException('Collision override could not be recorded');
    }
  }
}
