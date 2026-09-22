import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  OrganizationRelationshipController,
  TeamRosterController,
} from './structure.controller.js';
import { StructureService } from './structure.service.js';
import { RosterGuard } from './roster.guard.js';
@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule],
  controllers: [OrganizationRelationshipController, TeamRosterController],
  providers: [StructureService, RosterGuard],
})
export class StructureModule {}
