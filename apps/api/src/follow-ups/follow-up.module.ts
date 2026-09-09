import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignments/assignment.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { FollowUpRepositoryModule } from './follow-up-repository.module.js';
import { ProspectFollowUpController } from './prospect-follow-up.controller.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';
import { ProspectFollowUpService } from './prospect-follow-up.service.js';
import { FollowUpQueueController } from './follow-up-queue.controller.js';

@Module({
  imports: [
    AuthModule,

    AuthorizationModule,

    CampaignModule,

    AssignmentModule,

    ReservationModule,

    FollowUpRepositoryModule,
  ],

  controllers: [ProspectFollowUpController, FollowUpQueueController],

  providers: [ProspectFollowUpService, ProspectFollowUpQueryService],

  exports: [ProspectFollowUpService, ProspectFollowUpQueryService],
})
export class FollowUpModule {}
