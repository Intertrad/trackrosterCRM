import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReservationPolicyService } from './reservation-policy.service.js';
@Module({
  imports: [DatabaseModule],
  providers: [ReservationPolicyService],
  exports: [ReservationPolicyService],
})
export class ReservationPolicyModule {}
