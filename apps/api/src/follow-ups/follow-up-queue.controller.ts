import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ListFollowUpQueueQueryDto } from './list-follow-up-queue-query.dto.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('follow-ups')
@UseGuards(AuthGuard)
export class FollowUpQueueController {
  constructor(private readonly followUpQueryService: ProspectFollowUpQueryService) {}

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Query()
    query: ListFollowUpQueueQueryDto,
  ) {
    return this.followUpQueryService.listQueue({
      tenantId: auth.tenantId,

      userId: auth.userId,

      teamId: query.teamId,

      overdue: query.overdue,

      limit: query.limit,
    });
  }
}
