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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { ResourceAccess, ResourceAccessGuard } from '../resource-scopes/resource-access.guard.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { CreateTerritoryDto, LinkTerritoryDto, UpdateTerritoryDto } from './territory.dto.js';
import { TerritoryService } from './territory.service.js';
@Controller('territories')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class TerritoryController {
  constructor(private readonly service: TerritoryService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.service.list(auth);
  }
  @Get('map') map(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.service.map(auth);
  }
  @Get(':territoryId') get(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('territoryId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(auth, id);
  }
  @Post()
  @UseGuards(ClientAdminGuard)
  @Idempotent('territory.create')
  create(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateTerritoryDto) {
    return this.service.create(auth, input);
  }
  @Patch(':territoryId')
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('territory', 'read_write')
  @Idempotent('territory.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('territoryId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateTerritoryDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.service.update(auth, id, input, ifMatch);
  }
  @Delete(':territoryId')
  @HttpCode(204)
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('territory', 'manage')
  @Idempotent('territory.deactivate')
  async remove(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('territoryId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.service.update(auth, id, { status: 'inactive' }, ifMatch);
  }
}
@Controller('campaigns/:campaignId/territories')
@UseGuards(AuthGuard)
export class CampaignTerritoryController {
  constructor(private readonly service: TerritoryService) {}
  @Get() list(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
  ) {
    return this.service.campaignTerritories(auth, campaignId);
  }
  @Post()
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('campaign', 'manage')
  @Idempotent('campaign.territory_add')
  add(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Body() input: LinkTerritoryDto,
  ) {
    return this.service.link(auth, campaignId, input.territoryId);
  }
  @Delete(':territoryId')
  @HttpCode(204)
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('campaign', 'manage')
  @Idempotent('campaign.territory_remove')
  async remove(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('territoryId', new ParseUUIDPipe()) territoryId: string,
  ) {
    await this.service.link(auth, campaignId, territoryId, true);
  }
}
