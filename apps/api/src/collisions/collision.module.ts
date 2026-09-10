import { Module } from '@nestjs/common';

import { ActivityRepositoryModule } from '../activities/activity-repository.module.js';
import { AssignmentModule } from '../assignments/assignment.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { CoordinationPolicyModule } from '../coordination/coordination-policy.module.js';
import { CoolingOffModule } from '../cooling-off/cooling-off.module.js';
import { FollowUpRepositoryModule } from '../follow-ups/follow-up-repository.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';

import { CollisionDecisionController } from './collision-decision.controller.js';
import { CollisionDecisionService } from './collision-decision.service.js';
import { CollisionOverrideRepositoryModule } from './collision-override-repository.module.js';
import { ManagerOverrideService } from './manager-override.service.js';
import { ManagerOverrideController } from './manager-override.controller.js';
import { CollisionBusinessModule } from './collision-business.module.js';

@Module({
  imports: [
    AuthModule,

    AuthorizationModule,
    CollisionBusinessModule,

    CampaignModule,

    ReservationModule,

    CoolingOffModule,

    AssignmentModule,

    FollowUpRepositoryModule,

    ActivityRepositoryModule,

    CoordinationPolicyModule,

    CollisionOverrideRepositoryModule,
  ],

  controllers: [CollisionDecisionController, ManagerOverrideController],

  providers: [CollisionDecisionService, ManagerOverrideService],

  exports: [CollisionDecisionService, ManagerOverrideService],
})
export class CollisionModule {}
