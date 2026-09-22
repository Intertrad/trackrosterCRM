import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ConsentController, ConsentWriteGuard } from './consent.controller.js';
import { ConsentService } from './consent.service.js';
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ConsentController],
  providers: [ConsentService, ConsentWriteGuard],
})
export class ConsentModule {}
