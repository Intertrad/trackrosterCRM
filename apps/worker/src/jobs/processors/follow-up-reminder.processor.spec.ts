import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FollowUpReminderJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';

import { FollowUpReminderProcessor } from './follow-up-reminder.processor.js';

import {
  FollowUpReminderRepository,
  type FollowUpReminderContext,
} from '../repositories/follow-up-reminder.repository.js';

describe('FollowUpReminderProcessor', () => {
  let repository: {
    findContext: ReturnType<typeof vi.fn>;

    findEligibleRecipientUserIds: ReturnType<typeof vi.fn>;

    createNotificationsIfAbsent: ReturnType<typeof vi.fn>;
    queueEmailDeliveries?: ReturnType<typeof vi.fn>;
  };

  let processor: FollowUpReminderProcessor;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const followUpId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const campaignProspectId = '44444444-4444-4444-8444-444444444444';

  const establishmentId = '55555555-5555-4555-8555-555555555555';

  const assignmentId = '66666666-6666-4666-8666-666666666666';

  const organizationId = '77777777-7777-4777-8777-777777777777';

  const teamId = '88888888-8888-4888-8888-888888888888';

  const userId = '99999999-9999-4999-8999-999999999999';

  const scheduledFor = '2026-09-10T14:00:00.000Z';

  const validData: FollowUpReminderJobData = {
    jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    tenantId,

    requestedAt: '2026-09-10T13:00:00.000Z',

    followUpId,

    campaignId,

    campaignProspectId,

    scheduledFor,
  };

  const context = {
    jobId: validData.jobId,

    attempt: 1,

    maxAttempts: 3,
  };

  const followUp: FollowUpReminderContext = {
    id: followUpId,

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    assignedUserId: userId,

    dueAt: new Date(scheduledFor),

    status: 'pending',

    organizationId,

    teamId,

    assignmentEndedAt: null,

    campaignStatus: 'active',

    campaignProspectStatus: 'active',
  };

  beforeEach(() => {
    repository = {
      findContext: vi.fn().mockResolvedValue(followUp),

      findEligibleRecipientUserIds: vi.fn().mockResolvedValue([userId]),

      createNotificationsIfAbsent: vi.fn().mockResolvedValue(1),
    };

    processor = new FollowUpReminderProcessor(repository as unknown as FollowUpReminderRepository);
  });

  it('creates a notification for an actionable follow-up', async () => {
    const result = await processor.process(validData, context);

    expect(repository.findContext).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      followUpId,
    );

    expect(repository.findEligibleRecipientUserIds).toHaveBeenCalledWith(followUp);

    expect(repository.createNotificationsIfAbsent).toHaveBeenCalledWith(
      followUp,

      [userId],

      new Date(scheduledFor),
    );

    expect(result).toEqual({
      status: 'processed',
    });
  });

  it('queues durable email delivery after the in-app event', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    repository.queueEmailDeliveries = vi.fn().mockResolvedValue(['delivery-id']);
    processor = new FollowUpReminderProcessor(
      repository as unknown as FollowUpReminderRepository,
      {
        getQueue: () => ({ add }),
      } as never,
    );

    await expect(processor.process(validData, context)).resolves.toEqual({ status: 'processed' });

    expect(repository.queueEmailDeliveries).toHaveBeenCalledWith(followUp, new Date(scheduledFor));
    expect(add).toHaveBeenCalledWith(
      'notification.delivery',
      expect.objectContaining({ deliveryId: 'delivery-id', tenantId }),
      expect.objectContaining({ jobId: 'notification-delivery:delivery-id' }),
    );
  });

  it('returns noop when the follow-up no longer exists', async () => {
    repository.findContext.mockResolvedValue(null);

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'follow-up-not-found',
    });

    expect(repository.findEligibleRecipientUserIds).not.toHaveBeenCalled();

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when the follow-up is completed', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      status: 'completed',
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'follow-up-not-pending',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when the follow-up is cancelled', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      status: 'cancelled',
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'follow-up-not-pending',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when an older reminder job fires after rescheduling', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      dueAt: new Date('2026-09-10T16:00:00.000Z'),
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'follow-up-rescheduled',
    });

    expect(repository.findEligibleRecipientUserIds).not.toHaveBeenCalled();

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when the original assignment is stale', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      assignmentEndedAt: new Date('2026-09-10T13:30:00.000Z'),
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'follow-up-assignment-stale',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when the campaign is not active', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      campaignStatus: 'paused',
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'campaign-not-active',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when the campaign prospect is not active', async () => {
    repository.findContext.mockResolvedValue({
      ...followUp,

      campaignProspectStatus: 'inactive',
    });

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'campaign-prospect-not-active',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('returns noop when no eligible recipients exist', async () => {
    repository.findEligibleRecipientUserIds.mockResolvedValue([]);

    const result = await processor.process(validData, context);

    expect(result).toEqual({
      status: 'noop',

      reason: 'no-eligible-recipients',
    });

    expect(repository.createNotificationsIfAbsent).not.toHaveBeenCalled();
  });

  it('treats an already-created notification as successfully processed', async () => {
    repository.createNotificationsIfAbsent.mockResolvedValue(0);

    const result = await processor.process(validData, {
      ...context,

      attempt: 2,
    });

    /*
     * Zero inserted rows can mean an earlier
     * attempt already committed the notification.
     *
     * Database uniqueness makes this retry-safe.
     */
    expect(result).toEqual({
      status: 'processed',
    });

    expect(repository.createNotificationsIfAbsent).toHaveBeenCalledOnce();
  });

  it('throws a permanent error for an invalid scheduledFor timestamp', async () => {
    await expect(
      processor.process(
        {
          ...validData,

          scheduledFor: 'invalid-date',
        },

        context,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);

    expect(repository.findContext).not.toHaveBeenCalled();
  });

  it('throws a permanent error when tenantId is missing', async () => {
    await expect(
      processor.process(
        {
          ...validData,

          tenantId: '',
        },

        context,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);

    expect(repository.findContext).not.toHaveBeenCalled();
  });

  it('propagates transient PostgreSQL failures so BullMQ can retry', async () => {
    const databaseError = new Error('PostgreSQL unavailable');

    repository.findContext.mockRejectedValue(databaseError);

    await expect(processor.process(validData, context)).rejects.toBe(databaseError);
  });

  it('supports multiple recipients for a team-owned follow-up', async () => {
    const secondUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const teamOwnedFollowUp = {
      ...followUp,

      assignedUserId: null,
    };

    repository.findContext.mockResolvedValue(teamOwnedFollowUp);

    repository.findEligibleRecipientUserIds.mockResolvedValue([userId, secondUserId]);

    const result = await processor.process(validData, context);

    expect(repository.findEligibleRecipientUserIds).toHaveBeenCalledWith(teamOwnedFollowUp);

    expect(repository.createNotificationsIfAbsent).toHaveBeenCalledWith(
      teamOwnedFollowUp,

      [userId, secondUserId],

      new Date(scheduledFor),
    );

    expect(result).toEqual({
      status: 'processed',
    });
  });
});
