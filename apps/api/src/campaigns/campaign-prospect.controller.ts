import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { CampaignProspectService } from './campaign-prospect.service.js';
import { AddCampaignProspectDto } from './dto/add-campaign-prospect.dto.js';
import { EnrolCampaignProspectsDto } from './dto/enrol-campaign-prospects.dto.js';
import { UpdateCampaignProspectDto } from './dto/update-campaign-prospect.dto.js';
import { ListCampaignProspectsDto } from './dto/list-campaign-prospects.dto.js';

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
      actorUserId: auth.userId,
      campaignId,
      establishmentId: input.establishmentId,
    });
  }

  /*
   * Bulk enrolment. `preview` writes nothing and exists so the operator sees the
   * count before committing it — the same preview-then-apply shape the assignment
   * dispatch already uses, for the same reason.
   *
   * Static paths, declared above the `:prospectId` routes so they cannot be read
   * as an identifier.
   */
  @Post('bulk/preview')
  @HttpCode(200)
  previewEnrolment(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Body()
    input: EnrolCampaignProspectsDto,
  ) {
    return this.campaignProspectService.enrol(
      auth.tenantId,
      auth.userId,
      campaignId,
      input,
      'preview',
    );
  }

  @Post('bulk')
  @HttpCode(200)
  @Idempotent('campaign_prospect.bulk_enrol')
  enrol(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Body()
    input: EnrolCampaignProspectsDto,
  ) {
    return this.campaignProspectService.enrol(
      auth.tenantId,
      auth.userId,
      campaignId,
      input,
      'apply',
    );
  }

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,
    @Query() query: ListCampaignProspectsDto = {},
  ) {
    return this.campaignProspectService.list(auth.tenantId, campaignId, query.establishmentIds);
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
    return this.campaignProspectService.updateStatus({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      campaignId,
      prospectId,
      status: input.status,
    });
  }
}
