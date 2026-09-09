import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { OrganizationCoordinationPolicyType } from '../database/schema/organization-coordination-policies.js';
import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';

export type CoordinationPolicySource = 'same_organization' | 'default' | 'configured';

export interface ResolvedOrganizationCoordinationPolicy {
  policy: OrganizationCoordinationPolicyType;

  delayMinutes: number | null;

  source: CoordinationPolicySource;
}

@Injectable()
export class OrganizationCoordinationPolicyService {
  constructor(private readonly policyRepository: OrganizationCoordinationPolicyRepository) {}

  async resolve(
    tenantId: string,
    targetOrganizationId: string,
    conflictingOrganizationId: string,
  ): Promise<ResolvedOrganizationCoordinationPolicy> {
    /*
     * Same-organization prospecting keeps the
     * original TR-016 collision behavior.
     *
     * No policy row is required.
     */
    if (targetOrganizationId === conflictingOrganizationId) {
      return {
        policy: 'shared',

        delayMinutes: null,

        source: 'same_organization',
      };
    }

    let configuredPolicy;

    try {
      configuredPolicy = await this.policyRepository.findByOrganizations(
        tenantId,
        targetOrganizationId,
        conflictingOrganizationId,
      );
    } catch {
      /*
       * Coordination policy resolution affects
       * prospecting safety.
       *
       * Database failure therefore fails closed
       * rather than silently defaulting.
       */
      throw new ServiceUnavailableException('Coordination policy service is unavailable');
    }

    /*
     * Missing configuration preserves TR-016's
     * existing safe tenant-wide behavior.
     */
    if (!configuredPolicy) {
      return {
        policy: 'shared',

        delayMinutes: null,

        source: 'default',
      };
    }

    return {
      policy: configuredPolicy.policy,

      delayMinutes: configuredPolicy.delayMinutes,

      source: 'configured',
    };
  }
}
