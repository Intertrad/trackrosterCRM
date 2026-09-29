import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ScriptController } from './script.controller.js';
import { ScriptService } from './script.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule],
  controllers: [ScriptController],
  providers: [ScriptService],
})
export class ScriptsModule {}
