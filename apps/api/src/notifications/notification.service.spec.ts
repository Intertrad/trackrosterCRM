import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { NotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';

describe('NotificationService', () => {
  let notificationRepository: {
    findInbox: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };

  let service: NotificationService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const notificationId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    notificationRepository = {
      findInbox: vi.fn().mockResolvedValue([]),

      markRead: vi.fn().mockResolvedValue({
        id: notificationId,
        tenantId,
        recipientUserId: userId,
        readAt: new Date(),
      }),
    };

    service = new NotificationService(notificationRepository as unknown as NotificationRepository);
  });

  it('lists the authenticated user inbox with the default limit', async () => {
    await service.listInbox({
      tenantId,
      userId,
    });

    expect(notificationRepository.findInbox).toHaveBeenCalledWith(tenantId, userId, {
      unreadOnly: undefined,
      limit: 50,
    });
  });

  it('forwards unreadOnly and a custom limit', async () => {
    await service.listInbox({
      tenantId,
      userId,
      unreadOnly: true,
      limit: 25,
    });

    expect(notificationRepository.findInbox).toHaveBeenCalledWith(tenantId, userId, {
      unreadOnly: true,
      limit: 25,
    });
  });

  it('marks only the authenticated user notification as read', async () => {
    await service.markRead({
      tenantId,
      userId,
      notificationId,
    });

    expect(notificationRepository.markRead).toHaveBeenCalledWith(
      tenantId,
      userId,
      notificationId,
      expect.any(Date),
    );
  });

  it('returns 404 when the scoped notification does not exist', async () => {
    notificationRepository.markRead.mockResolvedValue(null);

    await expect(
      service.markRead({
        tenantId,
        userId,
        notificationId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
