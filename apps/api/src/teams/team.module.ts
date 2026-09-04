import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { TeamRepository } from './team.repository.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [DatabaseModule, OrganizationModule],
  providers: [TeamRepository, TeamService],
  exports: [TeamRepository, TeamService],
})
export class TeamModule {}
