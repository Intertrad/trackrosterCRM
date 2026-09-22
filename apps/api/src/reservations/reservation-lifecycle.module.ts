import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ReservationModule } from './reservation.module.js';
import { ReservationPolicyModule } from './reservation-policy.module.js';
import { ReservationRuleService } from './reservation-rule.service.js';
import { ReservationLifecycleService } from './reservation-lifecycle.service.js';
import {
  ReservationLifecycleController,
  ReservationRuleController,
  ReservationLifecycleGuard,
  ReservationRuleGuard,
} from './reservation-lifecycle.controller.js';
@Module({
  imports: [AuthModule, DatabaseModule, ReservationModule, ReservationPolicyModule],
  providers: [
    ReservationRuleService,
    ReservationLifecycleService,
    ReservationLifecycleGuard,
    ReservationRuleGuard,
  ],
  controllers: [ReservationLifecycleController, ReservationRuleController],
})
export class ReservationLifecycleModule {}
