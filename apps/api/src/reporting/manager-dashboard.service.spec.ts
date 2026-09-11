import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagerDashboardRepository } from './manager-dashboard.repository.js';
import { ManagerDashboardScopeService } from './manager-dashboard-scope.service.js';
import {
  DEFAULT_DASHBOARD_RANGE_DAYS,
  ManagerDashboardService,
} from './manager-dashboard.service.js';

describe('ManagerDashboardService', () => {
  let scopeService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let repository: {
    getActivitySummary: ReturnType<typeof vi.fn>;

    getAssignmentSummary: ReturnType<typeof vi.fn>;

    getFollowUpSummary: ReturnType<typeof vi.fn>;

    getActivityByProspector: ReturnType<typeof vi.fn>;

    getAssignmentsByProspector: ReturnType<typeof vi.fn>;

    getFollowUpsByProspector: ReturnType<typeof vi.fn>;
  };

  let service: ManagerDashboardService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const managerUserId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  const prospectorAId = '55555555-5555-4555-8555-555555555555';

  const prospectorBId = '66666666-6666-4666-8666-666666666666';

  const prospectorCId = '77777777-7777-4777-8777-777777777777';

  const campaignId = '88888888-8888-4888-8888-888888888888';

  const generatedAt = new Date('2026-09-11T10:00:00.000Z');

  beforeEach(() => {
    scopeService = {
      resolve: vi.fn().mockResolvedValue({
        authority: 'manager',

        organizationId,

        teamId,
      }),
    };

    repository = {
      getActivitySummary: vi.fn().mockResolvedValue({
        total: 7,

        byType: {
          call: 4,

          email: 3,
        },

        activeProspectors: 2,
      }),

      getAssignmentSummary: vi.fn().mockResolvedValue({
        current: 5,

        individuallyAssigned: 4,

        teamOwned: 1,
      }),

      getFollowUpSummary: vi.fn().mockResolvedValue({
        pending: 6,

        overdue: 2,

        dueInRange: 3,

        completedInRange: 4,

        cancelledInRange: 1,
      }),

      getActivityByProspector: vi.fn().mockResolvedValue([]),

      getAssignmentsByProspector: vi.fn().mockResolvedValue([]),

      getFollowUpsByProspector: vi.fn().mockResolvedValue([]),
    };

    service = new ManagerDashboardService(
      scopeService as unknown as ManagerDashboardScopeService,

      repository as unknown as ManagerDashboardRepository,
    );
  });

  it('uses the previous 30 days when no date range is supplied', async () => {
    const result = await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {},
      },

      generatedAt,
    );

    const expectedFrom = new Date(
      generatedAt.getTime() - DEFAULT_DASHBOARD_RANGE_DAYS * 24 * 60 * 60 * 1000,
    );

    expect(result.generatedAt).toBe(generatedAt.toISOString());

    expect(result.range).toEqual({
      from: expectedFrom.toISOString(),

      to: generatedAt.toISOString(),
    });

    expect(scopeService.resolve).toHaveBeenCalledWith({
      tenantId,

      userId: managerUserId,

      filters: {},
    });
  });

  it('uses the explicit half-open reporting range', async () => {
    const from = new Date('2026-09-01T00:00:00.000Z');

    const to = new Date('2026-09-10T00:00:00.000Z');

    const result = await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {
          from,

          to,
        },
      },

      generatedAt,
    );

    expect(result.range).toEqual({
      from: from.toISOString(),

      to: to.toISOString(),
    });

    expect(repository.getActivitySummary).toHaveBeenCalledWith(
      expect.objectContaining({
        range: {
          from,

          to,
        },
      }),
    );
  });

  it('passes authorized filters and scope to every reporting query', async () => {
    await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {
          organizationId,

          teamId,

          userId: prospectorAId,

          campaignId,
        },
      },

      generatedAt,
    );

    expect(scopeService.resolve).toHaveBeenCalledWith({
      tenantId,

      userId: managerUserId,

      filters: {
        organizationId,

        teamId,

        userId: prospectorAId,

        campaignId,
      },
    });

    const expectedInput = expect.objectContaining({
      tenantId,

      generatedAt,

      scope: {
        authority: 'manager',

        organizationId,

        teamId,
      },

      filters: {
        organizationId,

        teamId,

        userId: prospectorAId,

        campaignId,
      },
    });

    expect(repository.getActivitySummary).toHaveBeenCalledWith(expectedInput);

    expect(repository.getAssignmentSummary).toHaveBeenCalledWith(expectedInput);

    expect(repository.getFollowUpSummary).toHaveBeenCalledWith(expectedInput);

    expect(repository.getActivityByProspector).toHaveBeenCalledWith(expectedInput);

    expect(repository.getAssignmentsByProspector).toHaveBeenCalledWith(expectedInput);

    expect(repository.getFollowUpsByProspector).toHaveBeenCalledWith(expectedInput);
  });

  it('returns null for omitted public response filters', async () => {
    const result = await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {},
      },

      generatedAt,
    );

    expect(result.filters).toEqual({
      organizationId: null,

      teamId: null,

      userId: null,

      campaignId: null,
    });

    expect(result.scope).toEqual({
      authority: 'manager',

      organizationId,

      teamId,
    });
  });

  it('merges per-prospector metrics without duplicating users', async () => {
    repository.getActivityByProspector.mockResolvedValue([
      {
        userId: prospectorAId,

        activities: 5,
      },

      {
        userId: prospectorBId,

        activities: 2,
      },
    ]);

    repository.getAssignmentsByProspector.mockResolvedValue([
      {
        userId: prospectorAId,

        currentAssignments: 3,
      },

      {
        userId: prospectorCId,

        currentAssignments: 4,
      },
    ]);

    repository.getFollowUpsByProspector.mockResolvedValue([
      {
        userId: prospectorBId,

        pendingFollowUps: 2,

        overdueFollowUps: 1,
      },

      {
        userId: prospectorCId,

        pendingFollowUps: 3,

        overdueFollowUps: 0,
      },
    ]);

    const result = await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {},
      },

      generatedAt,
    );

    expect(result.byProspector).toEqual([
      {
        userId: prospectorAId,

        activities: 5,

        currentAssignments: 3,

        pendingFollowUps: 0,

        overdueFollowUps: 0,
      },

      {
        userId: prospectorBId,

        activities: 2,

        currentAssignments: 0,

        pendingFollowUps: 2,

        overdueFollowUps: 1,
      },

      {
        userId: prospectorCId,

        activities: 0,

        currentAssignments: 4,

        pendingFollowUps: 3,

        overdueFollowUps: 0,
      },
    ]);
  });

  it('returns the aggregate repository summaries unchanged', async () => {
    const result = await service.getDashboard(
      {
        tenantId,

        userId: managerUserId,

        query: {},
      },

      generatedAt,
    );

    expect(result.activities).toEqual({
      total: 7,

      byType: {
        call: 4,

        email: 3,
      },

      activeProspectors: 2,
    });

    expect(result.assignments).toEqual({
      current: 5,

      individuallyAssigned: 4,

      teamOwned: 1,
    });

    expect(result.followUps).toEqual({
      pending: 6,

      overdue: 2,

      dueInRange: 3,

      completedInRange: 4,

      cancelledInRange: 1,
    });
  });

  it('does not execute reporting queries when scope authorization fails', async () => {
    scopeService.resolve.mockRejectedValue(
      new ForbiddenException('User is not authorized to view manager reporting'),
    );

    await expect(
      service.getDashboard(
        {
          tenantId,

          userId: managerUserId,

          query: {},
        },

        generatedAt,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.getActivitySummary).not.toHaveBeenCalled();

    expect(repository.getAssignmentSummary).not.toHaveBeenCalled();

    expect(repository.getFollowUpSummary).not.toHaveBeenCalled();

    expect(repository.getActivityByProspector).not.toHaveBeenCalled();

    expect(repository.getAssignmentsByProspector).not.toHaveBeenCalled();

    expect(repository.getFollowUpsByProspector).not.toHaveBeenCalled();
  });

  it('defensively rejects a one-sided date range', async () => {
    await expect(
      service.getDashboard(
        {
          tenantId,

          userId: managerUserId,

          query: {
            from: new Date('2026-09-01T00:00:00.000Z'),
          },
        },

        generatedAt,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(scopeService.resolve).not.toHaveBeenCalled();
  });

  it('defensively rejects an inverted date range', async () => {
    await expect(
      service.getDashboard(
        {
          tenantId,

          userId: managerUserId,

          query: {
            from: new Date('2026-09-12T00:00:00.000Z'),

            to: new Date('2026-09-11T00:00:00.000Z'),
          },
        },

        generatedAt,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
