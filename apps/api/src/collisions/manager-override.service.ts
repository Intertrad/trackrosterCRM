import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';

import { AuthorizationService } from '../authorization/authorization.service.js';
import type { CollisionOverride } from '../database/schema/collision-overrides.js';
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

    private readonly authorizationService: AuthorizationService,

    private readonly reservationService: ReservationService,

    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateManagerOverrideInput): Promise<CollisionOverride> {
    const reason = input.reason.trim();

    /*
     * DTO validation will enforce this again at
     * the HTTP boundary in TR-022-F.
     *
     * Keep the domain service defensive so it is
     * also safe when called internally.
     */
    if (reason.length < 10 || reason.length > 1000) {
      throw new BadRequestException('Override reason must be between 10 and 1000 characters');
    }

    /*
     * Validate the TARGET PROSPECTOR and retrieve
     * authoritative assignment/canonical identity.
     *
     * This already verifies:
     *
     * - active campaign
     * - active campaign prospect
     * - current assignment
     * - active team
     * - active prospector
     * - individual assignment ownership
     * - exact team-level prospector grant
     */
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.prospectorUserId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    /*
     * Check authority BEFORE exposing/evaluating
     * collision details for this workflow.
     */
    const authority = await this.authorizationService.getOverrideAuthority(
      input.tenantId,

      input.approvedByUserId,

      assignment.organizationId,

      assignment.teamId,
    );

    if (!authority) {
      throw new ForbiddenException('User is not authorized to approve an override for this team');
    }

    /*
     * Re-evaluate server-side.
     *
     * Never trust a collision reason, conflict ID
     * or decision submitted by the frontend.
     */
    const collision = await this.collisionDecisionService.evaluate({
      tenantId: input.tenantId,

      userId: input.prospectorUserId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    /*
     * Defensive canonical-identity check.
     *
     * Both services should resolve the same
     * campaign prospect. A mismatch indicates
     * an internal consistency problem.
     */
    if (collision.establishmentId !== establishmentId) {
      throw new ServiceUnavailableException('Collision context is inconsistent');
    }

    /*
     * A live reservation is NEVER overrideable.
     *
     * This protects real-time mutual exclusion.
     */
    if (collision.reasonCode === 'ACTIVE_RESERVATION') {
      throw new ConflictException('Active reservation cannot be overridden');
    }

    /*
     * allow:
     *   no override required
     *
     * warn:
     *   advisory collision; reservation may proceed
     *   without manager authorization
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
        const override = await this.collisionOverrideRepository.create(
          {
            tenantId: input.tenantId,

            campaignId: input.campaignId,

            campaignProspectId: input.campaignProspectId,

            establishmentId,

            assignmentId: assignment.id,

            organizationId: assignment.organizationId,

            teamId: assignment.teamId,

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
    } catch {
      throw new ServiceUnavailableException('Collision override could not be recorded');
    }
  }
}
