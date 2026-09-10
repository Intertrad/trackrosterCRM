import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { CollisionOverrideRepository } from './collision-override.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [CollisionOverrideRepository],

  exports: [CollisionOverrideRepository],
})
export class CollisionOverrideRepositoryModule {}
