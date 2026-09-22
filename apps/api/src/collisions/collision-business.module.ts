import { ReservationPolicyModule } from '../reservations/reservation-policy.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PlannedActionCollisionRepository } from './planned-action-collision.repository.js';
import { Module } from '@nestjs/common';

import { ActivityRepositoryModule } from '../activities/activity-repository.module.js';
import { AssignmentModule } from '../assignments/assignment.module.js';
import { CoordinationPolicyModule } from '../coordination/coordination-policy.module.js';
import { CoolingOffModule } from '../cooling-off/cooling-off.module.js';
import { FollowUpRepositoryModule } from '../follow-ups/follow-up-repository.module.js';
import { CollisionBusinessDecisionService } from './collision-business-decision.service.js';

@Module({
  imports: [
    DatabaseModule,
    ReservationPolicyModule,
    CoolingOffModule,

    FollowUpRepositoryModule,

    AssignmentModule,

    ActivityRepositoryModule,

    CoordinationPolicyModule,
  ],

  providers: [CollisionBusinessDecisionService, PlannedActionCollisionRepository],

  exports: [CollisionBusinessDecisionService],
})
export class CollisionBusinessModule {}
