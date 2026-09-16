import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { GetWorkQueueProspectDetailQueryDto } from './dto/get-work-queue-prospect-detail-query.dto.js';
import { ListWorkQueueQueryDto } from './dto/list-work-queue-query.dto.js';
import { WorkQueueService } from './work-queue.service.js';
import type { WorkQueueProspectDetail, WorkQueueResponse } from './work-queue.types.js';

@Controller('work-queue')
@UseGuards(AuthGuard)
export class WorkQueueController {
  constructor(private readonly workQueueService: WorkQueueService) {}

  @Get()
  list(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Query()
    query: ListWorkQueueQueryDto,
  ): Promise<WorkQueueResponse> {
    return this.workQueueService.list({
      tenantId: auth.tenantId,

      userId: auth.userId,

      teamId: query.teamId,

      ...(query.campaignId
        ? {
            campaignId: query.campaignId,
          }
        : {}),

      ...(query.q
        ? {
            search: query.q,
          }
        : {}),

      ...(query.cursor
        ? {
            cursor: query.cursor,
          }
        : {}),

      ...(query.limit !== undefined
        ? {
            limit: query.limit,
          }
        : {}),
    });
  }

  @Get(':campaignId/:prospectId')
  getProspectDetail(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Query()
    query: GetWorkQueueProspectDetailQueryDto,
  ): Promise<WorkQueueProspectDetail> {
    return this.workQueueService.getProspectDetail({
      tenantId: auth.tenantId,

      userId: auth.userId,

      teamId: query.teamId,

      campaignId,

      campaignProspectId: prospectId,
    });
  }
}
