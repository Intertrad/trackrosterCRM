import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { ReadinessController } from './readiness.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { ProvidersModule } from '../providers/providers.module.js';

@Module({
  imports: [DatabaseModule, RedisModule, ProvidersModule],
  controllers: [HealthController, ReadinessController],
})
export class HealthModule {}
