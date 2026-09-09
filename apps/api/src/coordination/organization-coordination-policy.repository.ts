import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  organizationCoordinationPolicies,
  type NewOrganizationCoordinationPolicy,
  type OrganizationCoordinationPolicy,
} from '../database/schema/organization-coordination-policies.js';

export interface OrganizationPair {
  organizationAId: string;
  organizationBId: string;
}

@Injectable()
export class OrganizationCoordinationPolicyRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  canonicalizePair(firstOrganizationId: string, secondOrganizationId: string): OrganizationPair {
    if (firstOrganizationId === secondOrganizationId) {
      throw new Error('Coordination policy requires two distinct organizations');
    }

    if (firstOrganizationId < secondOrganizationId) {
      return {
        organizationAId: firstOrganizationId,

        organizationBId: secondOrganizationId,
      };
    }

    return {
      organizationAId: secondOrganizationId,

      organizationBId: firstOrganizationId,
    };
  }

  async findByOrganizations(
    tenantId: string,
    firstOrganizationId: string,
    secondOrganizationId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<OrganizationCoordinationPolicy | null> {
    const { organizationAId, organizationBId } = this.canonicalizePair(
      firstOrganizationId,
      secondOrganizationId,
    );

    const [policy] = await executor
      .select()
      .from(organizationCoordinationPolicies)
      .where(
        and(
          eq(organizationCoordinationPolicies.tenantId, tenantId),

          eq(organizationCoordinationPolicies.organizationAId, organizationAId),

          eq(organizationCoordinationPolicies.organizationBId, organizationBId),
        ),
      )
      .limit(1);

    return policy ?? null;
  }

  async create(
    input: NewOrganizationCoordinationPolicy,
    executor: DatabaseExecutor = this.database,
  ): Promise<OrganizationCoordinationPolicy> {
    const { organizationAId, organizationBId } = this.canonicalizePair(
      input.organizationAId,
      input.organizationBId,
    );

    const [policy] = await executor
      .insert(organizationCoordinationPolicies)
      .values({
        ...input,

        organizationAId,

        organizationBId,
      })
      .returning();

    if (!policy) {
      throw new Error('Failed to create organization coordination policy');
    }

    return policy;
  }
}
