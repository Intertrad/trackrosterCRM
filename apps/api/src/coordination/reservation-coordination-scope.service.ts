import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { OrganizationRepository } from '../organizations/organization.repository.js';
import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';

export interface ReservationCoordinationScope {
  targetOrganizationId: string;

  blockingOrganizationIds: string[];
}

@Injectable()
export class ReservationCoordinationScopeService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,

    private readonly coordinationPolicyService: OrganizationCoordinationPolicyService,
  ) {}

  async resolve(
    tenantId: string,
    targetOrganizationId: string,
  ): Promise<ReservationCoordinationScope> {
    let organizations;

    try {
      organizations = await this.organizationRepository.findByTenant(tenantId);
    } catch {
      /*
       * Reservation locking is safety-critical.
       *
       * If we cannot determine the organizations
       * participating in the tenant, we must not
       * silently weaken the collision scope.
       */
      throw new ServiceUnavailableException('Reservation coordination service is unavailable');
    }

    const targetOrganization = organizations.find(
      (organization) => organization.id === targetOrganizationId,
    );

    /*
     * In normal reservation flow this should be
     * impossible because assignment/campaign FKs
     * already guarantee organization integrity.
     *
     * Still fail closed if inconsistent state
     * reaches this service.
     */
    if (!targetOrganization) {
      throw new ServiceUnavailableException('Reservation coordination service is unavailable');
    }

    const blockingOrganizationIds = [targetOrganizationId];

    for (const organization of organizations) {
      if (organization.id === targetOrganizationId) {
        continue;
      }

      const resolved = await this.coordinationPolicyService.resolve(
        tenantId,
        targetOrganizationId,
        organization.id,
      );

      /*
       * Only explicitly INDEPENDENT organizations
       * may reserve the same canonical
       * establishment concurrently.
       *
       * SHARED, COORDINATED, DELAYED and missing
       * policies all remain part of the blocking
       * reservation scope.
       */
      if (resolved.policy === 'independent') {
        continue;
      }

      blockingOrganizationIds.push(organization.id);
    }

    /*
     * Stable ordering keeps Redis key ordering and
     * tests deterministic.
     */
    blockingOrganizationIds.sort();

    return {
      targetOrganizationId,

      blockingOrganizationIds,
    };
  }
}
