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
import { CampaignProspectService } from './campaign-prospect.service.js';
import { AddCampaignProspectDto } from './dto/add-campaign-prospect.dto.js';
import { UpdateCampaignProspectDto } from './dto/update-campaign-prospect.dto.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects')
@UseGuards(AuthGuard, ClientAdminGuard)
export class CampaignProspectController {
  constructor(private readonly campaignProspectService: CampaignProspectService) {}

  @Post()
  add(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Body()
    input: AddCampaignProspectDto,
  ) {
    return this.campaignProspectService.add({
      tenantId: auth.tenantId,
      campaignId,
      establishmentId: input.establishmentId,
    });
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,
  ) {
    return this.campaignProspectService.list(auth.tenantId, campaignId);
  }

  @Get(':prospectId')
  findById(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.campaignProspectService.findById(auth.tenantId, campaignId, prospectId);
  }

  @Patch(':prospectId')
  update(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    input: UpdateCampaignProspectDto,
  ) {
    return this.campaignProspectService.updateStatus(
      auth.tenantId,
      campaignId,
      prospectId,
      input.status,
    );
  }
}
