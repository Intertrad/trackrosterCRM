import { Module } from '@nestjs/common';

import { ReservationRedisService } from './reservation-redis.service.js';

@Module({
  providers: [ReservationRedisService],

  exports: [ReservationRedisService],
})
export class ReservationRedisModule {}
