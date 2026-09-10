import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';

describe('NotificationController', () => {
  let notificationService: {
    listInbox: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };

  let controller: NotificationController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const notificationId = '33333333-3333-4333-8333-333333333333';

  const auth = {
    tenantId,
    userId,
  };

  beforeEach(() => {
    notificationService = {
      listInbox: vi.fn().mockResolvedValue([]),

      markRead: vi.fn().mockResolvedValue({
        id: notificationId,
      }),
    };

    controller = new NotificationController(notificationService as unknown as NotificationService);
  });

  it('lists notifications for the authenticated user', async () => {
    await controller.list(auth, {
      unreadOnly: true,
      limit: 20,
    });

    expect(notificationService.listInbox).toHaveBeenCalledWith({
      tenantId,
      userId,
      unreadOnly: true,
      limit: 20,
    });
  });

  it('marks the authenticated user notification as read', async () => {
    await controller.markRead(auth, notificationId);

    expect(notificationService.markRead).toHaveBeenCalledWith({
      tenantId,
      userId,
      notificationId,
    });
  });
});
