import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ProspectorTodayController } from './prospector-today.controller.js';
import { ProspectorTodayService } from './prospector-today.service.js';

describe('ProspectorTodayController', () => {
  let service: {
    getToday: ReturnType<typeof vi.fn>;
  };

  let controller: ProspectorTodayController;

  const auth: AuthenticatedUser = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
  };

  beforeEach(() => {
    service = {
      getToday: vi.fn().mockResolvedValue({
        generatedAt: '2026-09-20T10:00:00.000Z',
        day: {
          date: '2026-09-20',
          timeZone: 'Europe/Paris',
          startsAt: '2026-09-19T22:00:00.000Z',
          endsAt: '2026-09-20T22:00:00.000Z',
        },
        summary: {
          actionsLeft: 0,
          toDo: 0,
          followUps: 0,
          meetings: 0,
          overdue: 0,
        },
        priorities: [],
      }),
    };

    controller = new ProspectorTodayController(service as unknown as ProspectorTodayService);
  });

  it('forwards authenticated identity and validated workspace query', async () => {
    await controller.getToday(auth, {
      teamId: '33333333-3333-4333-8333-333333333333',
      timeZone: 'Europe/Paris',
    });

    expect(service.getToday).toHaveBeenCalledWith({
      tenantId: auth.tenantId,
      userId: auth.userId,
      teamId: '33333333-3333-4333-8333-333333333333',
      timeZone: 'Europe/Paris',
    });
  });
});
