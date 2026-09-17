/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock, getManagerDashboardMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),

  getManagerDashboardMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/api/manager-dashboard-client', () => ({
  getManagerDashboard: getManagerDashboardMock,
}));

import ManagerDashboardPage from './page';

const organizationId = '11111111-1111-4111-8111-111111111111';

const teamId = '22222222-2222-4222-8222-222222222222';

const secondTeamId = '33333333-3333-4333-8333-333333333333';

const prospectorId = '44444444-4444-4444-8444-444444444444';

const managerDashboard = {
  generatedAt: '2026-09-17T08:00:00.000Z',

  range: {
    from: '2026-08-18T08:00:00.000Z',

    to: '2026-09-17T08:00:00.000Z',
  },

  scope: {
    authority: 'manager' as const,

    organizationId,

    teamId,
  },

  filters: {
    organizationId: null,

    teamId,

    userId: null,

    campaignId: null,
  },

  activities: {
    total: 12,

    byType: {
      call: 7,

      email: 5,
    },

    activeProspectors: 2,
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
      userId: prospectorId,

      activities: 6,

      currentAssignments: 4,

      pendingFollowUps: 2,

      overdueFollowUps: 1,
    },
  ],
};

function setAdminWorkspace(): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: 'tenant:client_admin:-:-',

      mode: 'admin',

      role: 'client_admin',

      scopeType: 'tenant',

      organizationId: null,

      teamId: null,
    },
  });
}

function setDirectorWorkspace(): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: `organization:director:${organizationId}:-`,

      mode: 'director',

      role: 'director',

      scopeType: 'organization',

      organizationId,

      teamId: null,
    },
  });
}

function setManagerWorkspace(selectedTeamId = teamId): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: `team:manager:${organizationId}:${selectedTeamId}`,

      mode: 'manager',

      role: 'manager',

      scopeType: 'team',

      organizationId,

      teamId: selectedTeamId,
    },
  });
}

function setProspectorWorkspace(): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: `team:prospector:${organizationId}:${teamId}`,

      mode: 'prospector',

      role: 'prospector',

      scopeType: 'team',

      organizationId,

      teamId,
    },
  });
}
afterEach(() => {
  cleanup();
});
describe('ManagerDashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    setManagerWorkspace();

    getManagerDashboardMock.mockResolvedValue(managerDashboard);
  });

  it('does not load reporting outside an authorized reporting workspace', () => {
    setProspectorWorkspace();

    render(<ManagerDashboardPage />);

    expect(
      screen.getByText('Manager Dashboard is not available in this workspace.'),
    ).toBeInTheDocument();

    expect(getManagerDashboardMock).not.toHaveBeenCalled();
  });

  it('loads tenant reporting for the Client Admin workspace', async () => {
    setAdminWorkspace();

    getManagerDashboardMock.mockResolvedValue({
      ...managerDashboard,

      scope: {
        authority: 'client_admin' as const,

        organizationId: null,

        teamId: null,
      },
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledWith({});
    });
  });

  it('loads organization reporting for the Director workspace', async () => {
    setDirectorWorkspace();

    getManagerDashboardMock.mockResolvedValue({
      ...managerDashboard,

      scope: {
        authority: 'director' as const,

        organizationId,

        teamId: null,
      },
    });

    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledWith({
        organizationId,
      });
    });
  });

  it('loads exact team reporting for the Manager workspace', async () => {
    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledWith({
        teamId,
      });
    });

    expect(await screen.findByText('Total activities')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders aggregate and per-Prospector reporting', async () => {
    render(<ManagerDashboardPage />);

    expect(await screen.findByText('Metrics by Prospector')).toBeInTheDocument();

    expect(screen.getByText(prospectorId)).toBeInTheDocument();

    expect(screen.getByText('Individually assigned')).toBeInTheDocument();

    expect(screen.getByText('Completed in period')).toBeInTheDocument();

    expect(screen.getByText('Call')).toBeInTheDocument();

    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('submits a custom calendar period as a half-open UTC range', async () => {
    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: {
        value: '2026-09-01',
      },
    });

    fireEvent.change(screen.getByLabelText('End date'), {
      target: {
        value: '2026-09-17',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Apply period',
      }),
    );

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenLastCalledWith({
        teamId,

        from: '2026-09-01T00:00:00.000Z',

        to: '2026-09-18T00:00:00.000Z',
      });
    });

    expect(getManagerDashboardMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an incomplete custom date range without calling the API again', async () => {
    render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: {
        value: '2026-09-01',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Apply period',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Choose both dates');

    expect(getManagerDashboardMock).toHaveBeenCalledTimes(1);
  });

  it('renders an empty reporting state', async () => {
    getManagerDashboardMock.mockResolvedValue({
      ...managerDashboard,

      activities: {
        total: 0,

        byType: {},

        activeProspectors: 0,
      },

      assignments: {
        current: 0,

        individuallyAssigned: 0,

        teamOwned: 0,
      },

      followUps: {
        pending: 0,

        overdue: 0,

        dueInRange: 0,

        completedInRange: 0,

        cancelledInRange: 0,
      },

      byProspector: [],
    });

    render(<ManagerDashboardPage />);

    expect(await screen.findByText('No reporting activity found')).toBeInTheDocument();

    expect(
      screen.getByText('No Prospector metrics are available for this scope and reporting period.'),
    ).toBeInTheDocument();
  });

  it('renders a reporting error and supports retry', async () => {
    getManagerDashboardMock
      .mockRejectedValueOnce(new Error('Reporting unavailable'))
      .mockResolvedValueOnce(managerDashboard);

    render(<ManagerDashboardPage />);

    expect(await screen.findByText('Reporting unavailable')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    expect(await screen.findByText('Metrics by Prospector')).toBeInTheDocument();

    expect(getManagerDashboardMock).toHaveBeenCalledTimes(2);
  });
  it('ignores an older dashboard response after the selected Manager team changes', async () => {
    let resolveFirst: ((value: typeof managerDashboard) => void) | undefined;

    const firstRequest = new Promise<typeof managerDashboard>((resolve) => {
      resolveFirst = resolve;
    });

    getManagerDashboardMock.mockReturnValueOnce(firstRequest).mockResolvedValueOnce({
      ...managerDashboard,

      scope: {
        ...managerDashboard.scope,

        teamId: secondTeamId,
      },

      filters: {
        ...managerDashboard.filters,

        teamId: secondTeamId,
      },

      activities: {
        ...managerDashboard.activities,

        total: 99,
      },
    });

    let currentWorkspace = {
      key: `team:manager:${organizationId}:${teamId}`,

      mode: 'manager' as const,

      role: 'manager' as const,

      scopeType: 'team' as const,

      organizationId,

      teamId,
    };

    useAuthMock.mockImplementation(() => ({
      activeWorkspace: currentWorkspace,
    }));

    const { rerender } = render(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledWith({
        teamId,
      });
    });

    currentWorkspace = {
      ...currentWorkspace,

      key: `team:manager:${organizationId}:${secondTeamId}`,

      teamId: secondTeamId,
    };

    rerender(<ManagerDashboardPage />);

    await waitFor(() => {
      expect(getManagerDashboardMock).toHaveBeenCalledWith({
        teamId: secondTeamId,
      });
    });

    expect(await screen.findByText('99')).toBeInTheDocument();

    await act(async () => {
      resolveFirst?.({
        ...managerDashboard,

        activities: {
          ...managerDashboard.activities,

          total: 12,
        },
      });

      await firstRequest;
    });

    expect(screen.getByText('99')).toBeInTheDocument();

    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});
