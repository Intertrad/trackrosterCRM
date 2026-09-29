/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';

const { useAuthMock, getManagerDashboardMock, listMembershipsMock, listOverrideRequestsMock } =
  vi.hoisted(() => ({
    useAuthMock: vi.fn(),
    getManagerDashboardMock: vi.fn(),
    listMembershipsMock: vi.fn(),
    listOverrideRequestsMock: vi.fn(),
  }));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));

vi.mock('@/lib/api/manager-dashboard-client', () => ({
  getManagerDashboard: getManagerDashboardMock,
}));

vi.mock('@/lib/api/membership-client', () => ({ listScopedMemberships: listMembershipsMock }));

vi.mock('@/lib/api/override-client', () => ({
  listOverrideRequests: listOverrideRequestsMock,
}));

import TeamOverviewPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';

const dashboard: ManagerDashboardResponse = {
  generatedAt: '2026-09-21T12:00:00.000Z',
  range: { from: '2026-09-14T00:00:00.000Z', to: '2026-09-21T12:00:00.000Z' },
  scope: { authority: 'manager', organizationId: null, teamId },
  filters: { organizationId: null, teamId, userId: null, campaignId: null },
  activities: { total: 412, byType: { call: 250, email: 162 }, activeProspectors: 6 },
  assignments: { current: 684, individuallyAssigned: 600, teamOwned: 84 },
  followUps: {
    pending: 219,
    overdue: 17,
    dueInRange: 200,
    completedInRange: 160,
    cancelledInRange: 4,
  },
  byProspector: [
    {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      activities: 48,
      currentAssignments: 142,
      pendingFollowUps: 20,
      overdueFollowUps: 2,
    },
    {
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      activities: 0,
      currentAssignments: 96,
      pendingFollowUps: 9,
      overdueFollowUps: 6,
    },
  ],
};

describe('TeamOverviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    useAuthMock.mockReturnValue({
      activeWorkspace: { mode: 'manager', scopeType: 'team', teamId, organizationId: null },
    });

    getManagerDashboardMock.mockResolvedValue(dashboard);

    listMembershipsMock.mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          identityId: 'i1',
          email: 'nabil@intertrad.test',
          displayName: 'Nabil Benchariki',
          status: 'active',
          roles: ['prospector'],
          capacity: 160,
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          identityId: 'i2',
          email: 'sophie@intertrad.test',
          displayName: 'Sophie Chevalier',
          status: 'active',
          roles: ['prospector'],
          capacity: 100,
        },
      ],
      nextCursor: null,
    });

    listOverrideRequestsMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(cleanup);

  it('reports the authoritative portfolio and overdue figures', async () => {
    render(<TeamOverviewPage />);

    expect(await screen.findByText('684')).toBeInTheDocument();
    expect(screen.getByText('219')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('shows real member names rather than opaque account ids', async () => {
    render(<TeamOverviewPage />);

    /* The reporting endpoint returns ids only; names come from /memberships. */
    expect((await screen.findAllByText('Nabil Benchariki')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sophie Chevalier').length).toBeGreaterThan(0);
  });

  it('scopes the request to the active team workspace', async () => {
    render(<TeamOverviewPage />);

    await screen.findByText('684');

    expect(getManagerDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({ teamId }),
      expect.any(AbortSignal),
    );

    expect(listMembershipsMock).toHaveBeenCalledWith(
      expect.objectContaining({ teamId, status: 'active' }),
      expect.any(AbortSignal),
    );
  });

  it('computes capacity from the member target, not a fixture', async () => {
    render(<TeamOverviewPage />);

    await screen.findByText('684');

    /* 142 of a 160 target is 89%; 96 of 100 is 96%. */
    expect(screen.getAllByText('89%').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('progressbar', { name: 'Capacity used' }).length).toBeGreaterThan(0);
  });

  it('reads member status from capacity, as the design specifies', async () => {
    render(<TeamOverviewPage />);

    /* Both members exceed 85% of their target, so both read as at risk. */
    expect((await screen.findAllByText('At risk')).length).toBeGreaterThan(0);
  });

  it('shows pending override requests from the register', async () => {
    listOverrideRequestsMock.mockResolvedValue({
      items: [
        {
          id: 'req-1',
          collisionId: 'c1',
          campaignProspectId: 'p1',
          requestedBy: 'u1',
          reason: 'Client asked for a call today.',
          status: 'pending',
          decidedBy: null,
          decisionReason: null,
          decidedAt: null,
          overrideId: null,
          createdAt: '2026-09-22T13:22:00.000Z',
          updatedAt: '2026-09-22T13:22:00.000Z',
          etag: '"v1"',
        },
      ],
      nextCursor: null,
    });

    render(<TeamOverviewPage />);

    expect(await screen.findByText('1 pending override request')).toBeInTheDocument();
    expect(screen.getByText('Client asked for a call today.')).toBeInTheDocument();
  });

  it('still renders when the override register is unavailable', async () => {
    listOverrideRequestsMock.mockRejectedValue(new Error('boom'));

    render(<TeamOverviewPage />);

    /* An advisory panel must never take the whole screen down. */
    expect(await screen.findByText('684')).toBeInTheDocument();
  });

  it('keeps the screen usable but flags that live figures failed', async () => {
    const { ApiError } = await import('@/lib/api/api-error');

    getManagerDashboardMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<TeamOverviewPage />);

    expect(
      await screen.findByText('You do not have reporting access for this scope.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Live figures are unavailable')).toBeInTheDocument();
  });

  it('retries the same scope after a failure', async () => {
    getManagerDashboardMock.mockRejectedValueOnce(new Error('network'));

    render(<TeamOverviewPage />);

    const retry = await screen.findByRole('button', { name: 'Try again' });

    getManagerDashboardMock.mockResolvedValue(dashboard);

    retry.click();

    await waitFor(() => {
      expect(screen.queryByText('Live figures are unavailable')).not.toBeInTheDocument();
    });

    expect(getManagerDashboardMock.mock.calls.length).toBeGreaterThan(1);
  });
});
