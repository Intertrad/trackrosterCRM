import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { notifications, type Notification } from '../database/schema/notifications.js';

export interface CreateFollowUpReminderNotificationInput {
  tenantId: string;

  recipientUserId: string;

  followUpId: string;

  scheduledFor: Date;

  title: string;

  message: string;
}

export interface NotificationInboxOptions {
  unreadOnly?: boolean;

  limit: number;
}

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  /*
   * Creates one follow-up reminder notification.
   *
   * The database unique index is the final
   * idempotency boundary:
   *
   * tenant
   * + recipient
   * + type
   * + follow-up
   * + scheduledFor
   *
   * A BullMQ retry therefore cannot create the same
   * notification twice.
   */
  async createFollowUpReminderIfAbsent(
    input: CreateFollowUpReminderNotificationInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<Notification | null> {
    const [notification] = await executor
      .insert(notifications)
      .values({
        tenantId: input.tenantId,

        recipientUserId: input.recipientUserId,

        type: 'follow_up_reminder',

        followUpId: input.followUpId,

        scheduledFor: input.scheduledFor,

        title: input.title,

        message: input.message,
      })
      .onConflictDoNothing({
        target: [
          notifications.tenantId,

          notifications.recipientUserId,

          notifications.type,

          notifications.followUpId,

          notifications.scheduledFor,
        ],
      })
      .returning();

    return notification ?? null;
  }

  /*
   * Batch variant used for team-owned follow-ups.
   *
   * One notification row is created per recipient.
   * Existing rows are skipped rather than failing
   * the entire worker retry.
   */
  async createFollowUpRemindersIfAbsent(
    inputs: CreateFollowUpReminderNotificationInput[],
    executor: DatabaseExecutor = this.database,
  ): Promise<Notification[]> {
    if (inputs.length === 0) {
      return [];
    }

    return executor
      .insert(notifications)
      .values(
        inputs.map((input) => ({
          tenantId: input.tenantId,

          recipientUserId: input.recipientUserId,

          type: 'follow_up_reminder' as const,

          followUpId: input.followUpId,

          scheduledFor: input.scheduledFor,

          title: input.title,

          message: input.message,
        })),
      )
      .onConflictDoNothing({
        target: [
          notifications.tenantId,

          notifications.recipientUserId,

          notifications.type,

          notifications.followUpId,

          notifications.scheduledFor,
        ],
      })
      .returning();
  }

  /*
   * User-scoped inbox query.
   *
   * recipientUserId is always part of the predicate;
   * callers cannot use this method to inspect another
   * user's notifications.
   */
  async findInbox(
    tenantId: string,
    recipientUserId: string,
    options: NotificationInboxOptions,
  ): Promise<Notification[]> {
    const unreadCondition = options.unreadOnly === true ? isNull(notifications.readAt) : undefined;

    return this.database
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),

          eq(notifications.recipientUserId, recipientUserId),

          unreadCondition,
        ),
      )
      .orderBy(
        desc(notifications.createdAt),

        desc(notifications.id),
      )
      .limit(options.limit);
  }

  /*
   * Marks only the authenticated user's own
   * notification as read.
   *
   * The tenant + recipient predicates prevent a
   * notification ID from being used across tenants
   * or users.
   */
  async markRead(
    tenantId: string,
    recipientUserId: string,
    notificationId: string,
    readAt: Date,
  ): Promise<Notification | null> {
    /*
     * First try to transition unread -> read.
     *
     * isNull(readAt) makes this an actual state
     * transition rather than rewriting readAt on
     * every repeated request.
     */
    const [updatedNotification] = await this.database
      .update(notifications)
      .set({
        readAt,
      })
      .where(
        and(
          eq(notifications.tenantId, tenantId),

          eq(notifications.recipientUserId, recipientUserId),

          eq(notifications.id, notificationId),

          isNull(notifications.readAt),
        ),
      )
      .returning();

    if (updatedNotification) {
      return updatedNotification;
    }

    /*
     * Nothing was updated.
     *
     * It may already be read. Return the existing
     * authenticated user's row without changing
     * its original readAt timestamp.
     *
     * If the row belongs to another user/tenant,
     * this lookup also returns nothing.
     */
    const [existingNotification] = await this.database
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),

          eq(notifications.recipientUserId, recipientUserId),

          eq(notifications.id, notificationId),
        ),
      )
      .limit(1);

    return existingNotification ?? null;
  }
}
