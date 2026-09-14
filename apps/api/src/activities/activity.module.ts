import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignments/assignment.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { ActivityRepositoryModule } from './activity-repository.module.js';
import { ProspectActivityController } from './prospect-activity.controller.js';
import { ProspectActivityService } from './prospect-activity.service.js';
import { ProspectTimelineController } from './prospect-timeline.controller.js';
import { ProspectTimelineService } from './prospect-timeline.service.js';

@Module({
  imports: [
    AuthModule,

    AuthorizationModule,

    CampaignModule,

    AssignmentModule,

    DatabaseModule,

    ReservationModule,

    ActivityRepositoryModule,
  ],

  controllers: [ProspectActivityController, ProspectTimelineController],

  providers: [ProspectActivityService, ProspectTimelineService],

  exports: [ProspectActivityService, ProspectTimelineService],
})
export class ActivityModule {}
