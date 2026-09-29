import { Injectable, NotFoundException } from '@nestjs/common';

import { NotificationRepository } from './notification.repository.js';

export interface ListNotificationInboxInput {
  severity?: 'info' | 'warning' | 'error' | 'critical';
  readState?: 'read' | 'unread' | 'all';
  tenantId: string;

  userId: string;

  unreadOnly?: boolean;

  limit?: number;
}

export interface MarkNotificationReadInput {
  tenantId: string;

  userId: string;

  notificationId: string;
}

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async listPage(input: ListNotificationInboxInput & { cursor?: string }) {
    const limit = input.limit ?? 50;
    const rows = await this.notificationRepository.findInboxPage(input.tenantId, input.userId, {
      limit,
      unreadOnly: input.unreadOnly,
      cursor: input.cursor,
      severity: input.severity,
      readState: input.readState,
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
    };
  }

  async unreadCount(tenantId: string, userId: string) {
    return { count: await this.notificationRepository.countUnread(tenantId, userId) };
  }

  async markAllRead(tenantId: string, userId: string) {
    return { updated: await this.notificationRepository.markAllRead(tenantId, userId) };
  }

  listInbox(input: ListNotificationInboxInput) {
    return this.notificationRepository.findInbox(
      input.tenantId,

      input.userId,

      {
        unreadOnly: input.unreadOnly,
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.readState ? { readState: input.readState } : {}),
        limit: input.limit ?? 50,
      },
    );
  }

  async markRead(input: MarkNotificationReadInput) {
    const notification = await this.notificationRepository.markRead(
      input.tenantId,

      input.userId,

      input.notificationId,

      new Date(),
    );

    if (!notification) {
      /*
       * Do not distinguish between:
       *
       * - nonexistent notification
       * - another user's notification
       * - another tenant's notification
       *
       * This avoids leaking notification existence.
       */
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }
}
