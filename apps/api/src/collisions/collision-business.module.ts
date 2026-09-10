import { Module } from '@nestjs/common';

import { ActivityRepositoryModule } from '../activities/activity-repository.module.js';
import { AssignmentModule } from '../assignments/assignment.module.js';
import { CoordinationPolicyModule } from '../coordination/coordination-policy.module.js';
import { CoolingOffModule } from '../cooling-off/cooling-off.module.js';
import { FollowUpRepositoryModule } from '../follow-ups/follow-up-repository.module.js';
import { CollisionBusinessDecisionService } from './collision-business-decision.service.js';

@Module({
  imports: [
    CoolingOffModule,

    FollowUpRepositoryModule,

    AssignmentModule,

    ActivityRepositoryModule,

    CoordinationPolicyModule,
  ],

  providers: [CollisionBusinessDecisionService],

  exports: [CollisionBusinessDecisionService],
})
export class CollisionBusinessModule {}
