import { Injectable } from '@nestjs/common';

import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';

export type CoordinationCollisionType =
  'active_reservation' | 'planned_action' | 'recent_contact' | 'active_assignment';

export type CoordinationCollisionAction = 'ignore' | 'block' | 'warn' | 'delayed';

export interface EvaluateCoordinationCollisionInput {
  tenantId: string;

  targetOrganizationId: string;

  conflictingOrganizationId: string;

  collisionType: CoordinationCollisionType;
}

export interface CoordinationCollisionPolicyResult {
  action: CoordinationCollisionAction;

  policy: 'shared' | 'coordinated' | 'delayed' | 'independent';

  delayMinutes: number | null;
}

@Injectable()
export class CoordinationCollisionPolicyService {
  constructor(private readonly coordinationPolicyService: OrganizationCoordinationPolicyService) {}

  async evaluate(
    input: EvaluateCoordinationCollisionInput,
  ): Promise<CoordinationCollisionPolicyResult> {
    const resolved = await this.coordinationPolicyService.resolve(
      input.tenantId,
      input.targetOrganizationId,
      input.conflictingOrganizationId,
    );

    /*
     * Independent organizations intentionally
     * ignore one another's prospecting activity.
     *
     * Same-organization resolution can never
     * become independent because resolve()
     * returns shared semantics for same-org.
     */
    if (resolved.policy === 'independent') {
      return {
        action: 'ignore',

        policy: resolved.policy,

        delayMinutes: null,
      };
    }

    /*
     * COORDINATED provides stronger ownership
     * separation than SHARED.
     *
     * An assignment belonging to a coordinated
     * organization therefore becomes a hard block.
     */
    if (resolved.policy === 'coordinated' && input.collisionType === 'active_assignment') {
      return {
        action: 'block',

        policy: resolved.policy,

        delayMinutes: null,
      };
    }

    /*
     * DELAYED modifies recent-contact behavior.
     *
     * The activity timestamp will be evaluated
     * later against this delay value.
     */
    if (resolved.policy === 'delayed' && input.collisionType === 'recent_contact') {
      return {
        action: 'delayed',

        policy: resolved.policy,

        delayMinutes: resolved.delayMinutes,
      };
    }

    /*
     * Active assignment remains advisory for
     * SHARED and DELAYED relationships.
     */
    if (input.collisionType === 'active_assignment') {
      return {
        action: 'warn',

        policy: resolved.policy,

        delayMinutes: resolved.delayMinutes,
      };
    }

    /*
     * ACTIVE_RESERVATION and PLANNED_ACTION remain
     * hard conflicts for SHARED, COORDINATED and
     * DELAYED relationships.
     *
     * RECENT_CONTACT remains a hard conflict under
     * SHARED and COORDINATED once cooling-off is
     * known to be active.
     */
    return {
      action: 'block',

      policy: resolved.policy,

      delayMinutes: resolved.delayMinutes,
    };
  }
}
