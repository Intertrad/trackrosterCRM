import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ReservationModule } from '../reservations/reservation.module.js';
import { ActivityRepositoryModule } from './activity-repository.module.js';
import { ProspectActivityController } from './prospect-activity.controller.js';
import { ProspectActivityService } from './prospect-activity.service.js';

@Module({
  imports: [AuthModule, ReservationModule, ActivityRepositoryModule],

  controllers: [ProspectActivityController],

  providers: [ProspectActivityService],

  exports: [ProspectActivityService],
})
export class ActivityModule {}
