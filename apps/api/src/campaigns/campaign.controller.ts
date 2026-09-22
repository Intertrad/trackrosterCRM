import { ResourceScopeService } from '../resource-scopes/resource-scope.service.js';
import { ResourceAccess, ResourceAccessGuard } from '../resource-scopes/resource-access.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { CampaignService } from './campaign.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

type AuthContext = AuthenticatedPrincipal;

@Controller('campaigns')
@UseGuards(AuthGuard)
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly scopes: ResourceScopeService,
  ) {}

  @Post()
  @UseGuards(ClientAdminGuard)
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Body()
    input: CreateCampaignDto,
  ) {
    return this.campaignService.create({
      ...input,
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
    });
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,
  ) {
    return this.scopes.listCampaigns(auth);
  }

  @Get(':campaignId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,
  ) {
    return this.scopes.getCampaign(auth, campaignId);
  }

  @Patch(':campaignId')
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('campaign', 'read_write')
  @Idempotent('campaign.update', { optional: true })
  update(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Body()
    input: UpdateCampaignDto,
  ) {
    return this.campaignService.update({
      ...input,
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      campaignId,
      authorization: auth,
    });
  }
}
