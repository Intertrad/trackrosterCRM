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
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  CreateCampaignMemberDto,
  CreateTerritoryAssignmentDto,
  ListParticipationDto,
  UpdateCampaignMemberDto,
  UpdateTerritoryAssignmentDto,
} from './participation.dto.js';
import { ParticipationGuard, ParticipationWrite } from './participation.guard.js';
import { ParticipationService } from './participation.service.js';
@Controller('territory-assignments')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class TerritoryAssignmentController {
  constructor(private readonly service: ParticipationService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListParticipationDto) {
    return this.service.list(auth, 'territory', query);
  }
  @Post()
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('territory', true)
  @Idempotent('territory_assignment.create')
  create(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateTerritoryAssignmentDto) {
    return this.service.create(auth, 'territory', input.territoryId, input);
  }
  @Patch(':id')
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('territory')
  @Idempotent('territory_assignment.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateTerritoryAssignmentDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.service.update(auth, 'territory', id, input, ifMatch);
  }
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('territory')
  @Idempotent('territory_assignment.end')
  async end(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.service.update(auth, 'territory', id, null, ifMatch);
  }
}
@Controller('campaigns/:campaignId/members')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class CampaignRosterController {
  constructor(private readonly service: ParticipationService) {}
  @Get() list(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Query() query: ListParticipationDto,
  ) {
    return this.service.list(auth, 'campaign', query, campaignId);
  }
  @Post()
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('campaign', true)
  @Idempotent('campaign_member.create')
  create(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Body() input: CreateCampaignMemberDto,
  ) {
    return this.service.create(auth, 'campaign', campaignId, input);
  }
}
@Controller('campaign-members')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class CampaignMemberController {
  constructor(private readonly service: ParticipationService) {}
  @Patch(':id')
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('campaign')
  @Idempotent('campaign_member.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateCampaignMemberDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.service.update(auth, 'campaign', id, input, ifMatch);
  }
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ParticipationGuard)
  @ParticipationWrite('campaign')
  @Idempotent('campaign_member.end')
  async end(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.service.update(auth, 'campaign', id, null, ifMatch);
  }
}
