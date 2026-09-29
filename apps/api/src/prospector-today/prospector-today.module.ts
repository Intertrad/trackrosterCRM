import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProspectorTodayController } from './prospector-today.controller.js';
import { ProspectorTodayRepository } from './prospector-today.repository.js';
import { ProspectorTodayService } from './prospector-today.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule],
  controllers: [ProspectorTodayController],
  providers: [ProspectorTodayRepository, ProspectorTodayService],
  exports: [ProspectorTodayService],
})
export class ProspectorTodayModule {}
