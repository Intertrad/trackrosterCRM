import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { CoordinationCollisionPolicyService } from './coordination-collision-policy.service.js';
import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';
import { OrganizationCoordinationPolicyService } from './organization-coordination-policy.service.js';
import { ReservationCoordinationScopeService } from './reservation-coordination-scope.service.js';
import { OrganizationCoordinationPolicyController } from './organization-coordination-policy.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, AuthorizationModule, OrganizationModule],

  providers: [
    OrganizationCoordinationPolicyRepository,
    OrganizationCoordinationPolicyService,
    CoordinationCollisionPolicyService,
    ReservationCoordinationScopeService,
  ],
  controllers: [OrganizationCoordinationPolicyController],

  exports: [
    OrganizationCoordinationPolicyRepository,
    OrganizationCoordinationPolicyService,
    CoordinationCollisionPolicyService,
    ReservationCoordinationScopeService,
  ],
})
export class CoordinationPolicyModule {}
