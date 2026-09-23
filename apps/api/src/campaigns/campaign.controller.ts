import { ListCampaignsDto } from './dto/list-campaigns.dto.js';
import { ResourceScopeService } from '../resource-scopes/resource-scope.service.js';
import { ResourceAccess, ResourceAccessGuard } from '../resource-scopes/resource-access.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  UseInterceptors,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { CampaignLifecycleService } from './campaign-lifecycle.service.js';
import { CampaignStatusDto } from './dto/campaign-status.dto.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

type AuthContext = AuthenticatedPrincipal;

@Controller('campaigns')
@UseGuards(AuthGuard)
export class CampaignController {
  constructor(
    private readonly lifecycle: CampaignLifecycleService,
    private readonly scopes: ResourceScopeService,
  ) {}

  @Post()
  @UseInterceptors(ResourceETagInterceptor)
  @UseGuards(ClientAdminGuard)
  @Idempotent('campaign.create', { optional: true })
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Body()
    input: CreateCampaignDto,
  ) {
    return this.lifecycle.create(auth, input);
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,
    @Query() query?: ListCampaignsDto,
  ) {
    return this.scopes.listCampaigns(auth, query);
  }

  @Get(':campaignId')
  @UseInterceptors(ResourceETagInterceptor)
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,
  ) {
    return this.scopes.getCampaign(auth, campaignId);
  }

  @Patch(':campaignId')
  @UseInterceptors(ResourceETagInterceptor)
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
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.lifecycle.update(auth, campaignId, input, ifMatch);
  }
  @Post(':campaignId/status')
  @UseInterceptors(ResourceETagInterceptor)
  @HttpCode(200)
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('campaign', 'manage')
  @Idempotent('campaign.status')
  status(
    @CurrentAuth() auth: AuthContext,
    @Param('campaignId', new ParseUUIDPipe()) id: string,
    @Body() input: CampaignStatusDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.lifecycle.update(auth, id, { status: input.status }, ifMatch, input.reason);
  }
  @Delete(':campaignId')
  @HttpCode(204)
  @UseGuards(ResourceAccessGuard)
  @ResourceAccess('campaign', 'manage')
  @Idempotent('campaign.archive')
  async archive(
    @CurrentAuth() auth: AuthContext,
    @Param('campaignId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    await this.lifecycle.update(
      auth,
      id,
      { status: 'archived' },
      ifMatch,
      'Archived through campaign endpoint',
    );
  }
}
