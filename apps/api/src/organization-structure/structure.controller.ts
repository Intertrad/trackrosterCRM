import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  CreateRelationshipDto,
  CreateRosterDto,
  ListRelationshipsDto,
  ListRosterDto,
  RosterTargetDto,
  UpdateRosterDto,
} from './structure.dto.js';
import { StructureService } from './structure.service.js';
import { RosterGuard } from './roster.guard.js';
@Controller('organization-relationships')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class OrganizationRelationshipController {
  constructor(private readonly structure: StructureService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListRelationshipsDto) {
    return this.structure.listRelationships(auth, query);
  }
  @Post()
  @UseGuards(ClientAdminGuard)
  @Idempotent('organization_relationship.create')
  create(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateRelationshipDto) {
    return this.structure.createRelationship(auth, input);
  }
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ClientAdminGuard)
  @Idempotent('organization_relationship.end')
  async end(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.structure.endRelationship(auth, id, ifMatch);
  }
}
@Controller('teams/:teamId/members')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class TeamRosterController {
  constructor(private readonly structure: StructureService) {}
  @Get() list(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Query() query: ListRosterDto,
  ) {
    return this.structure.listRoster(auth, teamId, query);
  }
  @Post()
  @UseGuards(RosterGuard)
  @Idempotent('team_roster.create')
  create(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() input: CreateRosterDto,
  ) {
    return this.structure.createRoster(auth, teamId, input);
  }
  @Patch(':membershipId')
  @UseGuards(RosterGuard)
  @Idempotent('team_roster.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Query() query: RosterTargetDto,
    @Body() input: UpdateRosterDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.structure.updateRoster(auth, teamId, membershipId, input, query.periodId, ifMatch);
  }
  @Delete(':membershipId')
  @HttpCode(204)
  @UseGuards(RosterGuard)
  @Idempotent('team_roster.end')
  async end(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Query() query: RosterTargetDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.structure.updateRoster(auth, teamId, membershipId, null, query.periodId, ifMatch);
  }
}
