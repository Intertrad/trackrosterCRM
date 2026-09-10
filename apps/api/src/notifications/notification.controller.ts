import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ListNotificationsQueryDto } from './notification.dto.js';
import { NotificationService } from './notification.service.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Query()
    query: ListNotificationsQueryDto,
  ) {
    return this.notificationService.listInbox({
      tenantId: auth.tenantId,

      userId: auth.userId,

      unreadOnly: query.unreadOnly,

      limit: query.limit,
    });
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentAuth()
    auth: AuthContext,

    @Param('notificationId', new ParseUUIDPipe())
    notificationId: string,
  ) {
    return this.notificationService.markRead({
      tenantId: auth.tenantId,

      userId: auth.userId,

      notificationId,
    });
  }
}
