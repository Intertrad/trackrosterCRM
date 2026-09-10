import { Injectable, NotFoundException } from '@nestjs/common';

import { NotificationRepository } from './notification.repository.js';

export interface ListNotificationInboxInput {
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

  listInbox(input: ListNotificationInboxInput) {
    return this.notificationRepository.findInbox(
      input.tenantId,

      input.userId,

      {
        unreadOnly: input.unreadOnly,

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
