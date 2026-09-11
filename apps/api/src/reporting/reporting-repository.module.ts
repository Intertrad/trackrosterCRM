import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ManagerDashboardRepository } from './manager-dashboard.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [ManagerDashboardRepository],

  exports: [ManagerDashboardRepository],
})
export class ReportingRepositoryModule {}
