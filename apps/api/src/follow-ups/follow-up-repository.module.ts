import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [ProspectFollowUpRepository],

  exports: [ProspectFollowUpRepository],
})
export class FollowUpRepositoryModule {}
