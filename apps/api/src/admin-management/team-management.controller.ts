import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import type { Team } from '../database/schema/teams.js';
import { TeamService } from '../teams/team.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamStatusDto } from './dto/update-team-status.dto.js';

@Controller('organizations/:organizationId/teams')
@UseGuards(AuthGuard, ClientAdminGuard)
export class TeamManagementController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  async list(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('organizationId')
    organizationId: string,
  ): Promise<Team[]> {
    return this.teamService.findByOrganization(auth.tenantId, organizationId);
  }

  @Post()
  async create(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('organizationId')
    organizationId: string,

    @Body()
    input: CreateTeamDto,
  ): Promise<Team> {
    return this.teamService.create({
      tenantId: auth.tenantId,
      organizationId,
      name: input.name,
      slug: input.slug,
    });
  }

  @Patch(':teamId/status')
  async updateStatus(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('organizationId')
    organizationId: string,

    @Param('teamId')
    teamId: string,

    @Body()
    input: UpdateTeamStatusDto,
  ): Promise<Team> {
    return this.teamService.updateStatus(auth.tenantId, organizationId, teamId, input.status);
  }
}
