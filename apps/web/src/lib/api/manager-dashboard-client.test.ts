import { beforeEach, describe, expect, it, vi } from 'vitest';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import { getManagerDashboard } from './manager-dashboard-client';

const dashboardResponse = {
  generatedAt: '2026-09-17T08:00:00.000Z',

  range: {
    from: '2026-08-18T08:00:00.000Z',

    to: '2026-09-17T08:00:00.000Z',
  },

  scope: {
    authority: 'manager' as const,

    organizationId: '11111111-1111-4111-8111-111111111111',

    teamId: '22222222-2222-4222-8222-222222222222',
  },

  filters: {
    organizationId: null,

    teamId: null,

    userId: null,

    campaignId: null,
  },

  activities: {
    total: 12,

    byType: {
      call: 7,

      email: 5,
    },

    activeProspectors: 3,
  },

  assignments: {
    current: 8,

    individuallyAssigned: 6,

    teamOwned: 2,
  },

  followUps: {
    pending: 5,

    overdue: 2,

    dueInRange: 4,

    completedInRange: 9,

    cancelledInRange: 1,
  },

  byProspector: [
    {
      userId: '33333333-3333-4333-8333-333333333333',

      activities: 6,

      currentAssignments: 4,

      pendingFollowUps: 2,

      overdueFollowUps: 1,
    },
  ],
};

describe('getManagerDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    browserJsonMock.mockResolvedValue(dashboardResponse);
  });

  it('requests the dashboard without query parameters by default', async () => {
    const result = await getManagerDashboard();

    expect(browserJsonMock).toHaveBeenCalledTimes(1);

    expect(browserJsonMock).toHaveBeenCalledWith('/api/manager/dashboard', {
      method: 'GET',

      cache: 'no-store',
    });

    expect(result).toBe(dashboardResponse);
  });

  it('forwards a complete reporting query', async () => {
    const from = '2026-09-01T00:00:00.000Z';

    const to = '2026-09-17T00:00:00.000Z';

    await getManagerDashboard({
      from,

      to,

      organizationId: '11111111-1111-4111-8111-111111111111',

      teamId: '22222222-2222-4222-8222-222222222222',

      userId: '33333333-3333-4333-8333-333333333333',

      campaignId: '44444444-4444-4444-8444-444444444444',
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      [
        '/api/manager/dashboard',
        '?from=2026-09-01T00%3A00%3A00.000Z',
        '&to=2026-09-17T00%3A00%3A00.000Z',
        '&organizationId=11111111-1111-4111-8111-111111111111',
        '&teamId=22222222-2222-4222-8222-222222222222',
        '&userId=33333333-3333-4333-8333-333333333333',
        '&campaignId=44444444-4444-4444-8444-444444444444',
      ].join(''),
      {
        method: 'GET',

        cache: 'no-store',
      },
    );
  });

  it('only includes provided optional dimensions', async () => {
    await getManagerDashboard({
      teamId: '22222222-2222-4222-8222-222222222222',

      campaignId: '44444444-4444-4444-8444-444444444444',
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      [
        '/api/manager/dashboard',
        '?teamId=22222222-2222-4222-8222-222222222222',
        '&campaignId=44444444-4444-4444-8444-444444444444',
      ].join(''),
      {
        method: 'GET',

        cache: 'no-store',
      },
    );
  });

  it('preserves an explicitly supplied empty query value for Nest validation', async () => {
    await getManagerDashboard({
      organizationId: '',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/manager/dashboard?organizationId=', {
      method: 'GET',

      cache: 'no-store',
    });
  });

  it('returns the typed dashboard response unchanged', async () => {
    const result = await getManagerDashboard({
      teamId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result).toEqual(dashboardResponse);

    expect(result.scope.authority).toBe('manager');

    expect(result.activities.byType).toEqual({
      call: 7,

      email: 5,
    });

    expect(result.byProspector[0]).toEqual({
      userId: '33333333-3333-4333-8333-333333333333',

      activities: 6,

      currentAssignments: 4,

      pendingFollowUps: 2,

      overdueFollowUps: 1,
    });
  });

  it('propagates browserJson errors', async () => {
    const expectedError = new Error('Manager reporting unavailable');

    browserJsonMock.mockRejectedValue(expectedError);

    await expect(getManagerDashboard()).rejects.toBe(expectedError);
  });
});
