import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ListProspectTimelineQueryDto } from './prospect-timeline.dto.js';
import { ProspectTimelineService } from './prospect-timeline.service.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/timeline')
@UseGuards(AuthGuard)
export class ProspectTimelineController {
  constructor(private readonly prospectTimelineService: ProspectTimelineService) {}

  @Get()
  getTimeline(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Query()
    query: ListProspectTimelineQueryDto,
  ) {
    return this.prospectTimelineService.getTimeline({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      limit: query.limit,

      cursor: query.cursor,
    });
  }
}
