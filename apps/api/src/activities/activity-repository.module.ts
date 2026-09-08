import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ProspectActivityRepository } from './prospect-activity.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [ProspectActivityRepository],

  exports: [ProspectActivityRepository],
})
export class ActivityRepositoryModule {}
