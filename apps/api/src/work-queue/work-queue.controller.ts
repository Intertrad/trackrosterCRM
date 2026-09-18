import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

import { ListWorkQueueQueryDto, type WorkQueueResponseDto } from './work-queue.dto.js';

import { WorkQueueService } from './work-queue.service.js';

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
  ): Promise<WorkQueueResponseDto> {
    return this.workQueueService.list({
      tenantId: auth.tenantId,

      userId: auth.userId,

      search: query.search,

      limit: query.limit,

      cursor: query.cursor,
    });
  }
}
