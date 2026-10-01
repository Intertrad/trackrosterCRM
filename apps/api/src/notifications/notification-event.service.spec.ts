import { describe, expect, it, vi } from 'vitest';

import { NotificationEventService } from './notification-event.service.js';

describe('NotificationEventService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const notification = { id: '33333333-3333-4333-8333-333333333333' };

  it('persists collision alerts as critical in-app events', async () => {
    const repository = {
      createIfAbsent: vi.fn().mockResolvedValue(notification),
      queueDelivery: vi.fn(),
    };
    const service = new NotificationEventService({} as never, repository as never);

    await service.collision({
      tenantId,
      prospectorUserId: userId,
      campaignProspectId: '44444444-4444-4444-8444-444444444444',
      reasonCode: 'RECENT_CONTACT',
      establishmentId: '55555555-5555-4555-8555-555555555555',
    });

    expect(repository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        recipientUserId: userId,
        type: 'collision_or_recent_contact',
        severity: 'critical',
      }),
      expect.anything(),
    );
  });

  it('creates durable channel outbox rows only after the inbox row', async () => {
    const order: string[] = [];
    const repository = {
      createIfAbsent: vi.fn().mockImplementation(async () => {
        order.push('notification');
        return notification;
      }),
      queueDelivery: vi.fn().mockImplementation(async () => {
        order.push('delivery');
        return { id: '66666666-6666-4666-8666-666666666666' };
      }),
    };
    const jobs = { enqueue: vi.fn() };
    const service = new NotificationEventService({} as never, repository as never, jobs as never);

    await service.create({
      tenantId,
      recipientUserId: userId,
      type: 'follow_up_due',
      severity: 'info',
      eventKey: 'follow-up:1',
      title: 'Follow-up due',
      message: 'A follow-up is due.',
      channels: ['email'],
    });

    expect(order).toEqual(['notification', 'delivery']);
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it('resolves override recipients from active manager grants', async () => {
    const managerId = '77777777-7777-4777-8777-777777777777';
    const where = vi.fn().mockResolvedValue([{ userId: managerId }]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where,
      }),
    };
    const repository = {
      createIfAbsent: vi.fn().mockResolvedValue(notification),
      queueDelivery: vi.fn().mockResolvedValue({ id: '88888888-8888-4888-8888-888888888888' }),
    };
    const jobs = { enqueue: vi.fn() };
    const service = new NotificationEventService(db as never, repository as never, jobs as never);

    await service.overrideRequested({
      tenantId,
      teamId: '99999999-9999-4999-8999-999999999999',
      campaignProspectId: '44444444-4444-4444-8444-444444444444',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(repository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: managerId,
        type: 'override_requested',
        channels: ['push'],
      }),
      expect.anything(),
    );
  });

  it('resolves import anomaly recipients from active client-admin grants', async () => {
    const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ userId: adminId }]),
      }),
    };
    const repository = {
      createIfAbsent: vi.fn().mockResolvedValue(notification),
      queueDelivery: vi.fn(),
    };
    const service = new NotificationEventService(db as never, repository as never);

    await service.importAnomalies({
      tenantId,
      importId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      anomalyCount: 3,
    });

    expect(repository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: adminId,
        type: 'import_completed_with_anomalies',
        severity: 'info',
      }),
      expect.anything(),
    );
  });
});
