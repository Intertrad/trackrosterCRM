/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import type { ProspectorTodayResponse } from '@/lib/api/prospector-today-types';

const { useAuthMock, getProspectorTodayMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getProspectorTodayMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/api/prospector-today-client', () => ({
  getProspectorToday: getProspectorTodayMock,
}));

import TodayPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';
const secondTeamId = '99999999-9999-4999-8999-999999999999';
const campaignId = '22222222-2222-4222-8222-222222222222';
const campaignProspectId = '33333333-3333-4333-8333-333333333333';

const todayResponse: ProspectorTodayResponse = {
  generatedAt: '2026-09-20T10:00:00.000Z',
  day: {
    date: '2026-09-20',
    timeZone: 'Europe/Paris',
    startsAt: '2026-09-19T22:00:00.000Z',
    endsAt: '2026-09-20T22:00:00.000Z',
  },
  summary: {
    actionsLeft: 4,
    toDo: 0,
    followUps: 0,
    meetings: 0,
    overdue: 4,
    completedToday: 12,
  },
  priorities: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      campaignId,
      campaignProspectId,
      dueAt: '2026-09-20T09:00:00.000Z',
      isOverdue: true,
      category: 'meeting',
      channel: 'visit',
      establishment: {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Nancy central police station',
        city: 'Nancy',
        phone: '+33 3 83 00 00 00',
        latitude: 49.1595,
        longitude: 5.3833,
      },
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      campaignId,
      campaignProspectId: '77777777-7777-4777-8777-777777777777',
      dueAt: '2026-09-20T12:30:00.000Z',
      isOverdue: false,
      category: 'todo',
      channel: null,
      establishment: {
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Saint-Dié hospital',
        city: null,
        phone: null,
        latitude: 49.1595,
        longitude: 5.3833,
      },
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function setProspectorWorkspace(selectedTeamId = teamId): void {
  useAuthMock.mockReturnValue({
    user: {
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: 'prospector@intertrad.test',
      displayName: 'Nabil Benali',
      grants: [],
    },
    activeWorkspace: {
      key: `team:prospector:organization:${selectedTeamId}`,
      mode: 'prospector',
      scopeType: 'team',
      teamId: selectedTeamId,
    },
  });
}

describe('TodayPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Europe/Paris',
    });

    setProspectorWorkspace();
    getProspectorTodayMock.mockResolvedValue(todayResponse);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('never requests the prospector queue outside a prospector workspace', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'manager@intertrad.test', displayName: 'Marie Garnier' },
      activeWorkspace: {
        key: 'team:manager:organization:team',
        mode: 'manager',
        scopeType: 'team',
        teamId,
      },
    });

    render(<TodayPage />);

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await waitFor(() => {
      expect(getProspectorTodayMock).not.toHaveBeenCalled();
    });
  });

  it('explains itself instead of calling an endpoint that needs a team', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'prospector@intertrad.test', displayName: 'Nabil Benali' },
      activeWorkspace: { mode: 'prospector', scopeType: 'tenant', teamId: null },
    });

    render(<TodayPage />);

    expect(screen.getByText('Today is a team view.')).toBeInTheDocument();

    await waitFor(() => {
      expect(getProspectorTodayMock).not.toHaveBeenCalled();
    });
  });

  it('loads and renders the authoritative Today contract', async () => {
    render(<TodayPage />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();

    /* The date follows the viewer's locale, so assert the parts, not an order. */
    expect(screen.getByText(/Sunday/)).toBeInTheDocument();
    expect(screen.getByText(/September/)).toBeInTheDocument();
    /* The name appears twice by design: once as a next action and once as a
     * numbered stop in the day's visits. */
    expect(screen.getAllByText('Nancy central police station')).toHaveLength(2);
    expect(screen.getByText('Nancy')).toBeInTheDocument();
    expect(screen.getAllByText('Saint-Dié hospital')).toHaveLength(1);
    /* Due time shows on the action row and on its map stop. */
    expect(screen.getAllByText('11:00').length).toBeGreaterThan(0);

    expect(getProspectorTodayMock).toHaveBeenCalledWith({
      teamId,
      timeZone: 'Europe/Paris',
      signal: expect.any(AbortSignal),
    });
  });

  it('plots only on-site work, not calls and emails', async () => {
    render(<TodayPage />);

    await screen.findByRole('heading', { name: 'Today' });

    /*
     * Both fixtures carry coordinates, but only one is a visit. Counting a
     * phone call as a stop would inflate the round the prospector is about
     * to drive and the distance quoted for it.
     */
    const stops = screen.getByRole('list', { name: "Today's visit order" });

    expect(within(stops).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText(/^1 stop/)).toBeInTheDocument();
  });

  it('links each priority to its prospect rather than inventing a detail view', async () => {
    render(<TodayPage />);

    const [link] = await screen.findAllByRole('link', {
      name: 'Nancy central police station',
    });

    expect(link).toHaveAttribute('href', `/work-queue/${campaignId}/${campaignProspectId}`);
  });

  it('filters to overdue work without refetching', async () => {
    render(<TodayPage />);

    await screen.findAllByText('Nancy central police station');

    fireEvent.click(screen.getByRole('button', { name: /Overdue/ }));

    expect(screen.getAllByText('Nancy central police station').length).toBeGreaterThan(0);
    /* The filter narrows Next actions only. The day's visits deliberately
     * keeps the whole round, so scope the assertion to the action list. */
    const actions = within(screen.getByRole('list', { name: 'Next actions' }));

    expect(actions.queryByText('Saint-Dié hospital')).not.toBeInTheDocument();
    expect(actions.getAllByText('Nancy central police station').length).toBeGreaterThan(0);

    /* Filtering is a view concern; it must never hit the network again. */
    expect(getProspectorTodayMock).toHaveBeenCalledTimes(1);
  });

  it('shows the truthful empty state without inventing work', async () => {
    getProspectorTodayMock.mockResolvedValue({
      ...todayResponse,
      summary: { actionsLeft: 0, toDo: 0, followUps: 0, meetings: 0, overdue: 0 },
      priorities: [],
    });

    render(<TodayPage />);

    expect(await screen.findByText('Your day is clear')).toBeInTheDocument();
  });

  it('shows an error and retries the same selected workspace', async () => {
    getProspectorTodayMock.mockRejectedValueOnce(new Error('network'));

    render(<TodayPage />);

    expect(await screen.findByText('We could not load your day.')).toBeInTheDocument();

    getProspectorTodayMock.mockResolvedValue(todayResponse);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect((await screen.findAllByText('Nancy central police station')).length).toBeGreaterThan(0);

    expect(getProspectorTodayMock).toHaveBeenLastCalledWith(expect.objectContaining({ teamId }));
  });

  it('keeps current data visible while a manual refresh is running', async () => {
    render(<TodayPage />);

    await screen.findAllByText('Nancy central police station');

    const pending = deferred<ProspectorTodayResponse>();
    getProspectorTodayMock.mockReturnValueOnce(pending.promise);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh today' }));

    /* A refresh must not blank the queue the prospector is working from. */
    expect(screen.getAllByText('Nancy central police station').length).toBeGreaterThan(0);

    await act(async () => {
      pending.resolve(todayResponse);
      await pending.promise;
    });

    expect(screen.getAllByText('Nancy central police station').length).toBeGreaterThan(0);
  });

  it('ignores a stale response after the active team changes', async () => {
    const pending = deferred<ProspectorTodayResponse>();
    getProspectorTodayMock.mockReturnValueOnce(pending.promise);

    const view = render(<TodayPage />);

    setProspectorWorkspace(secondTeamId);
    getProspectorTodayMock.mockResolvedValue({
      ...todayResponse,
      priorities: [
        {
          ...todayResponse.priorities[0]!,
          establishment: {
            id: '55555555-5555-4555-8555-555555555555',
            name: 'Second team prospect',
            city: 'Metz',
            latitude: 49.1595,
            longitude: 5.3833,
          },
        },
      ],
    });

    view.rerender(<TodayPage />);

    await act(async () => {
      /* The first team's response lands after the switch and must be dropped. */
      pending.resolve(todayResponse);
      await pending.promise;
    });

    expect((await screen.findAllByText('Second team prospect')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Nancy central police station')).not.toBeInTheDocument();
  });
});
