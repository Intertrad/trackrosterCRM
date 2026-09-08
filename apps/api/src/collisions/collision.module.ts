import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { CollisionDecisionController } from './collision-decision.controller.js';
import { CollisionDecisionService } from './collision-decision.service.js';

@Module({
  imports: [AuthModule, CampaignModule, ReservationModule],

  controllers: [CollisionDecisionController],

  providers: [CollisionDecisionService],

  exports: [CollisionDecisionService],
})
export class CollisionModule {}
