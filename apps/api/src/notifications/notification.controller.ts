import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ListNotificationsQueryDto } from './notification.dto.js';
import { NotificationService } from './notification.service.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';

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
    @Req() request?: { url: string },
  ) {
    if (request?.url.startsWith('/api/v1/')) {
      return this.notificationService.listPage({
        tenantId: auth.tenantId,
        userId: auth.userId,
        ...query,
      });
    }
    return this.notificationService.listInbox({
      tenantId: auth.tenantId,

      userId: auth.userId,

      unreadOnly: query.unreadOnly,
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.readState ? { readState: query.readState } : {}),

      limit: query.limit,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentAuth() auth: AuthContext) {
    return this.notificationService.unreadCount(auth.tenantId, auth.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  @Idempotent('notification.read_all')
  markAllRead(@CurrentAuth() auth: AuthContext) {
    return this.notificationService.markAllRead(auth.tenantId, auth.userId);
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  @Idempotent('notification.read')
  markReadVersioned(
    @CurrentAuth() auth: AuthContext,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notificationService.markRead({
      tenantId: auth.tenantId,
      userId: auth.userId,
      notificationId,
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
