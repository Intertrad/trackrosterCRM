import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
import type { ManagerDashboardResponse } from './manager-dashboard.types.js';

@Controller('manager/dashboard')
@UseGuards(AuthGuard)
export class ManagerDashboardController {
  constructor(private readonly dashboardService: ManagerDashboardService) {}

  @Get()
  getDashboard(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Query()
    query: ManagerDashboardQueryDto,
  ): Promise<ManagerDashboardResponse> {
    return this.dashboardService.getDashboard({
      tenantId: auth.tenantId,

      userId: auth.userId,

      query,
    });
  }
}
