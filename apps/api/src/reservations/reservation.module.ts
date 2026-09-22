import { ReservationPolicyModule } from './reservation-policy.module.js';
import { ReservationLedgerService } from './reservation-ledger.service.js';
import { ReservationHistoryInterceptor } from './reservation-history.interceptor.js';
import { DatabaseModule } from '../database/database.module.js';
import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignments/assignment.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { CollisionBusinessModule } from '../collisions/collision-business.module.js';
import { CollisionOverrideRepositoryModule } from '../collisions/collision-override-repository.module.js';
import { CoordinationPolicyModule } from '../coordination/coordination-policy.module.js';
import { JobQueueModule } from '../jobs/job-queue.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { TeamModule } from '../teams/team.module.js';
import { UserModule } from '../users/user.module.js';

import { ReservationController } from './reservation.controller.js';
import { ReservationExpirySchedulerService } from './reservation-expiry-scheduler.service.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationService } from './reservation.service.js';

@Module({
  imports: [
    DatabaseModule,
    ReservationPolicyModule,
    RedisModule,

    AuthModule,

    CampaignModule,

    AssignmentModule,

    TeamModule,

    UserModule,

    AuthorizationModule,

    CoordinationPolicyModule,

    JobQueueModule,

    /*
     * Shared persisted-business collision evaluator.
     *
     * Import the small lower-level module rather
     * than CollisionModule to avoid:
     *
     * ReservationModule -> CollisionModule
     * CollisionModule   -> ReservationModule
     */
    CollisionBusinessModule,

    /*
     * Provides CollisionOverrideRepository used
     * when an overrideId is presented during
     * reservation acquisition.
     */
    CollisionOverrideRepositoryModule,
  ],

  controllers: [ReservationController],

  providers: [
    ReservationHistoryInterceptor,
    ReservationLedgerService,
    ReservationRepository,
    ReservationExpirySchedulerService,
    ReservationService,
  ],

  exports: [
    ReservationRepository,
    ReservationService,
    ReservationLedgerService,
    ReservationExpirySchedulerService,
  ],
})
export class ReservationModule {}
