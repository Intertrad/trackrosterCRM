import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ProspectorTodayQueryDto } from './prospector-today-query.dto.js';
import { ProspectorTodayService } from './prospector-today.service.js';
import type { ProspectorTodayResponse } from './prospector-today.types.js';

@Controller('prospector/today')
@UseGuards(AuthGuard)
export class ProspectorTodayController {
  constructor(private readonly todayService: ProspectorTodayService) {}

  @Get()
  getToday(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Query()
    query: ProspectorTodayQueryDto,
  ): Promise<ProspectorTodayResponse> {
    return this.todayService.getToday({
      tenantId: auth.tenantId,
      userId: auth.userId,
      teamId: query.teamId,
      timeZone: query.timeZone,
    });
  }
}
