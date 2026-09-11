import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ManagerDashboardController } from './manager-dashboard.controller.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';

describe('ManagerDashboardController', () => {
  let dashboardService: {
    getDashboard: ReturnType<typeof vi.fn>;
  };

  let controller: ManagerDashboardController;

  const auth: AuthenticatedUser = {
    tenantId: '11111111-1111-4111-8111-111111111111',

    userId: '22222222-2222-4222-8222-222222222222',
  };

  const response = {
    generatedAt: '2026-09-11T10:00:00.000Z',

    range: {
      from: '2026-08-12T10:00:00.000Z',

      to: '2026-09-11T10:00:00.000Z',
    },

    scope: {
      authority: 'manager' as const,

      organizationId: '33333333-3333-4333-8333-333333333333',

      teamId: '44444444-4444-4444-8444-444444444444',
    },

    filters: {
      organizationId: null,

      teamId: null,

      userId: null,

      campaignId: null,
    },

    activities: {
      total: 7,

      byType: {
        call: 4,

        email: 3,
      },

      activeProspectors: 2,
    },

    assignments: {
      current: 5,

      individuallyAssigned: 4,

      teamOwned: 1,
    },

    followUps: {
      pending: 6,

      overdue: 2,

      dueInRange: 3,

      completedInRange: 4,

      cancelledInRange: 1,
    },

    byProspector: [],
  };

  beforeEach(() => {
    dashboardService = {
      getDashboard: vi.fn().mockResolvedValue(response),
    };

    controller = new ManagerDashboardController(
      dashboardService as unknown as ManagerDashboardService,
    );
  });

  it('forwards authenticated tenant and user identity to the service', async () => {
    const result = await controller.getDashboard(
      auth,

      {},
    );

    expect(dashboardService.getDashboard).toHaveBeenCalledWith({
      tenantId: auth.tenantId,

      userId: auth.userId,

      query: {},
    });

    expect(result).toEqual(response);
  });

  it('forwards dashboard query filters unchanged', async () => {
    const from = new Date('2026-09-01T00:00:00.000Z');

    const to = new Date('2026-09-11T00:00:00.000Z');

    const query = {
      from,

      to,

      organizationId: '33333333-3333-4333-8333-333333333333',

      teamId: '44444444-4444-4444-8444-444444444444',

      userId: '55555555-5555-4555-8555-555555555555',

      campaignId: '66666666-6666-4666-8666-666666666666',
    };

    await controller.getDashboard(
      auth,

      query,
    );

    expect(dashboardService.getDashboard).toHaveBeenCalledWith({
      tenantId: auth.tenantId,

      userId: auth.userId,

      query,
    });
  });
});
