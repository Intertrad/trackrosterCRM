import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { CoordinationCollisionPolicyService } from './coordination-collision-policy.service.js';
import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';
import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';
import { ReservationCoordinationScopeService } from './reservation-coordination-scope.service.js';

@Module({
  imports: [DatabaseModule, OrganizationModule],

  providers: [
    OrganizationCoordinationPolicyRepository,
    OrganizationCoordinationPolicyService,
    CoordinationCollisionPolicyService,
    ReservationCoordinationScopeService,
  ],

  exports: [
    OrganizationCoordinationPolicyRepository,
    OrganizationCoordinationPolicyService,
    CoordinationCollisionPolicyService,
    ReservationCoordinationScopeService,
  ],
})
export class CoordinationPolicyModule {}
