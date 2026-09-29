import { FollowUpModule } from '../follow-ups/follow-up.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobQueueModule } from '../jobs/job-queue.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { ActionController, ActionWriteGuard } from './action.controller.js';
import { ActionService } from './action.service.js';
import { ActionEffectsService } from './action-effects.service.js';
import { UnifiedTimelineController } from './unified-timeline.controller.js';
import { UnifiedTimelineService } from './unified-timeline.service.js';
@Module({
  imports: [AuthModule, DatabaseModule, JobQueueModule, ReservationModule, FollowUpModule],
  controllers: [ActionController, UnifiedTimelineController],
  providers: [ActionService, ActionWriteGuard, ActionEffectsService, UnifiedTimelineService],
})
export class ActionModule {}
