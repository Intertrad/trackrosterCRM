import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignments/assignment.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { TeamModule } from '../teams/team.module.js';
import { UserModule } from '../users/user.module.js';
import { ReservationController } from './reservation.controller.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationService } from './reservation.service.js';
import { CoolingOffModule } from '../cooling-off/cooling-off.module.js';

@Module({
  imports: [
    RedisModule,
    AuthModule,
    CampaignModule,
    AssignmentModule,
    TeamModule,
    UserModule,
    AuthorizationModule,
    CoolingOffModule,
  ],

  controllers: [ReservationController],

  providers: [ReservationRepository, ReservationService],

  exports: [ReservationRepository, ReservationService],
})
export class ReservationModule {}
