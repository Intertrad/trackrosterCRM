import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { CreateProspectActivityDto } from './prospect-activity.dto.js';
import { ProspectActivityService } from './prospect-activity.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/activities')
@UseGuards(AuthGuard)
export class ProspectActivityController {
  constructor(private readonly prospectActivityService: ProspectActivityService) {}

  @Post()
  record(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    body: CreateProspectActivityDto,
  ) {
    return this.prospectActivityService.record({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      type: body.type,
    });
  }
}
