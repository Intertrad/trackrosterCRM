import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { UserRepository } from './user.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
