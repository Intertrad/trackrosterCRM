import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { TeamManagementGuard } from './team-management.guard.js';
import {
  Body,
  Headers,
  UseInterceptors,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { WorkspaceAdministrationService } from './workspace-administration.service.js';
import {
  CreateOrganizationDto,
  CreateTeamDto,
  ListTeamsDto,
  ListWorkspaceResourcesDto,
  UpdateOrganizationDto,
  UpdateTeamDto,
  UpdateTenantDto,
} from './workspace.dto.js';

@Controller('tenant')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class TenantSettingsController {
  constructor(private readonly workspace: WorkspaceAdministrationService) {}
  @Get()
  get(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.workspace.tenant(auth);
  }
  @Patch()
  @Idempotent('tenant.update')
  @UseGuards(ClientAdminGuard)
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: UpdateTenantDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.updateTenant(auth, input, ifMatch);
  }
}

@Controller('organizations')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class OrganizationAdministrationController {
  constructor(private readonly workspace: WorkspaceAdministrationService) {}
  @Get()
  list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListWorkspaceResourcesDto) {
    return this.workspace.listOrganizations(auth, query);
  }
  @Post()
  @Idempotent('organization.create')
  @UseGuards(ClientAdminGuard)
  create(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateOrganizationDto) {
    return this.workspace.createOrganization(auth, input);
  }
  @Get(':organizationId')
  get(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('organizationId', new ParseUUIDPipe()) id: string,
  ) {
    return this.workspace.organization(auth, id);
  }
  @Patch(':organizationId')
  @Idempotent('organization.update')
  @UseGuards(ClientAdminGuard)
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('organizationId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateOrganizationDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.updateOrganization(auth, id, input, ifMatch);
  }
  @Delete(':organizationId/permanent')
  @Idempotent('organization.delete_permanently')
  @UseGuards(ClientAdminGuard)
  deletePermanently(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('organizationId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.deleteOrganizationPermanently(auth, id, ifMatch);
  }

  @Delete(':organizationId')
  @Idempotent('organization.deactivate')
  @UseGuards(ClientAdminGuard)
  deactivate(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('organizationId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.updateOrganization(auth, id, { status: 'inactive' }, ifMatch);
  }
}

@Controller('teams')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class TeamAdministrationController {
  constructor(private readonly workspace: WorkspaceAdministrationService) {}
  @Get()
  list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListTeamsDto) {
    return this.workspace.listTeams(auth, query);
  }
  @Post()
  @Idempotent('team.create')
  @UseGuards(ClientAdminGuard)
  create(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateTeamDto) {
    return this.workspace.createTeam(auth, input);
  }
  @Get(':teamId')
  get(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) id: string,
  ) {
    return this.workspace.team(auth, id);
  }
  @Get(':teamId/capacity')
  capacity(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) id: string,
  ) {
    return this.workspace.capacity(auth, id);
  }
  @Patch(':teamId')
  @Idempotent('team.update')
  @UseGuards(TeamManagementGuard)
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateTeamDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.updateTeam(auth, id, input, ifMatch);
  }
  @Delete(':teamId')
  @Idempotent('team.deactivate')
  @UseGuards(TeamManagementGuard)
  deactivate(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.workspace.updateTeam(auth, id, { status: 'inactive' }, ifMatch);
  }
}
