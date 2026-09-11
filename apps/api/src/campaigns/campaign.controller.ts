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

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns')
@UseGuards(AuthGuard, ClientAdminGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
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
    return this.campaignService.list(auth.tenantId);
  }

  @Get(':campaignId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,
  ) {
    return this.campaignService.findById(auth.tenantId, campaignId);
  }

  @Patch(':campaignId')
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
    });
  }
}
