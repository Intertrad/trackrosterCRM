/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  WorkQueueCampaignOption,
  WorkQueueItem,
  WorkQueueOptionsResponse,
  WorkQueueResponse,
} from '@/lib/api/work-queue-types';

const { getWorkQueueOptionsMock, listWorkQueueMock, useAuthMock } = vi.hoisted(() => ({
  getWorkQueueOptionsMock: vi.fn(),

  listWorkQueueMock: vi.fn(),

  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/api/work-queue-client', () => ({
  getWorkQueueOptions: getWorkQueueOptionsMock,

  listWorkQueue: listWorkQueueMock,
}));

import MyProspectsPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';

const organizationId = '22222222-2222-4222-8222-222222222222';

const campaignId = '33333333-3333-4333-8333-333333333333';

const prospectId = '44444444-4444-4444-8444-444444444444';

const assignmentId = '55555555-5555-4555-8555-555555555555';

const establishmentId = '66666666-6666-4666-8666-666666666666';

const fixedNow = '2026-09-20T12:00:00.000Z';

const queueItem: WorkQueueItem = {
  campaignProspectId: prospectId,

  lifecycleStage: 'in_progress',

  latestActivity: {
    type: 'call',

    occurredAt: '2026-09-19T12:00:00.000Z',
  },

  nextFollowUp: {
    id: '77777777-7777-4777-8777-777777777777',

    dueAt: fixedNow,
  },

  campaign: {
    id: campaignId,

    name: 'Autumn outreach',
  },

  assignment: {
    id: assignmentId,

    organizationId,

    teamId,

    assignedAt: '2026-09-17T08:00:00.000Z',
  },

  establishment: {
    id: establishmentId,

    regionId: null,

    name: 'North Star Dental',

    addressLine1: '12 Market Street',

    postalCode: '75001',

    city: 'Paris',

    countryCode: 'FR',

    latitude: 49.1596,

    longitude: 5.3828,

    phone: '+33 1 23 45 67 89',

    website: 'https://www.north-star.example/appointments',

    status: 'active',
  },
};

const firstPage: WorkQueueResponse = {
  items: [queueItem],

  page: {
    limit: 25,

    hasMore: false,

    nextCursor: null,
  },
};

const campaignOption: WorkQueueCampaignOption = {
  id: campaignId,

  name: 'Autumn outreach',
};

const campaignOptions: WorkQueueOptionsResponse = {
  campaigns: [campaignOption],
};

function setProspectorWorkspace(selectedTeamId = teamId): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: `team:prospector:${organizationId}:${selectedTeamId}`,

      mode: 'prospector',

      role: 'prospector',

      scopeType: 'team',

      organizationId,

      teamId: selectedTeamId,
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

describe('WorkQueuePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(fixedNow));

    setProspectorWorkspace();
    listWorkQueueMock.mockResolvedValue(firstPage);
    getWorkQueueOptionsMock.mockResolvedValue(campaignOptions);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not load assignments outside a prospector team workspace', async () => {
    useAuthMock.mockReturnValue({
      activeWorkspace: { mode: 'admin', scopeType: 'tenant', teamId: null },
    });

    render(<MyProspectsPage />);

    expect(screen.getByText('This view is scoped to a team.')).toBeInTheDocument();

    await waitFor(() => {
      expect(listWorkQueueMock).not.toHaveBeenCalled();
    });
  });

  it('loads the selected team queue and renders only API-backed prospect data', async () => {
    render(<MyProspectsPage />);

    expect(await screen.findByRole('heading', { name: 'My prospects' })).toBeInTheDocument();

    expect(listWorkQueueMock).toHaveBeenCalledWith(expect.objectContaining({ teamId }));

    const first = firstPage.items[0]!;

    expect(screen.getByRole('link', { name: first.establishment.name })).toHaveAttribute(
      'href',
      `/work-queue/${first.campaign.id}/${first.campaignProspectId}`,
    );
  });

  it('asks the backend to filter by lifecycle status', async () => {
    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'qualified' } });

    await waitFor(() => {
      expect(listWorkQueueMock).toHaveBeenCalledWith(
        expect.objectContaining({ teamId, lifecycleStage: 'qualified' }),
      );
    });
  });

  it('asks the backend to filter by campaign using the loaded options', async () => {
    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    await waitFor(() => {
      expect(getWorkQueueOptionsMock).toHaveBeenCalledWith(expect.objectContaining({ teamId }));
    });

    fireEvent.change(screen.getByLabelText('Campaign'), {
      target: { value: campaignOption.id },
    });

    await waitFor(() => {
      expect(listWorkQueueMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: campaignOption.id }),
      );
    });
  });

  it('debounces search so typing does not fire a request per keystroke', async () => {
    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    const initialCalls = listWorkQueueMock.mock.calls.length;

    const field = screen.getByLabelText('Search my portfolio');

    fireEvent.change(field, { target: { value: 'n' } });
    fireEvent.change(field, { target: { value: 'na' } });
    fireEvent.change(field, { target: { value: 'nan' } });

    expect(listWorkQueueMock.mock.calls.length).toBe(initialCalls);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(listWorkQueueMock).toHaveBeenCalledWith(expect.objectContaining({ q: 'nan' }));
    });
  });

  it('distinguishes a filtered empty result from an empty portfolio', async () => {
    listWorkQueueMock.mockResolvedValue({
      items: [],
      page: { limit: 25, hasMore: false, nextCursor: null },
    });

    render(<MyProspectsPage />);

    expect(
      await screen.findByText('No establishments are assigned to you yet.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'qualified' } });

    expect(await screen.findByText('No prospects match these filters.')).toBeInTheDocument();
  });

  it('surfaces a read failure instead of showing an empty portfolio', async () => {
    listWorkQueueMock.mockRejectedValue(new Error('boom'));

    render(<MyProspectsPage />);

    expect(
      await screen.findByText('We could not load your portfolio. Please try again.'),
    ).toBeInTheDocument();
  });

  it('ignores a slower response from a superseded filter', async () => {
    const slow = deferred<WorkQueueResponse>();

    listWorkQueueMock.mockReturnValueOnce(slow.promise);

    render(<MyProspectsPage />);

    const fresh: WorkQueueResponse = {
      ...firstPage,
      items: [
        {
          ...firstPage.items[0]!,
          campaignProspectId: '43000000-0000-4000-8000-000000000001',
          establishment: {
            ...firstPage.items[0]!.establishment,
            id: '43000000-0000-4000-8000-000000000002',
            name: 'Fresh result',
          },
        },
      ],
    };

    /* Queue the replacement before the filter change triggers the refetch. */
    listWorkQueueMock.mockResolvedValue(fresh);

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'converted' } });

    await act(async () => {
      slow.resolve(firstPage);
      await slow.promise;
    });

    expect(await screen.findByText('Fresh result')).toBeInTheDocument();

    expect(screen.queryByText(firstPage.items[0]!.establishment.name)).not.toBeInTheDocument();
  });
  it('plots only geocoded prospects on the map view', async () => {
    listWorkQueueMock.mockResolvedValue({
      ...firstPage,
      items: [
        firstPage.items[0]!,
        {
          ...firstPage.items[0]!,
          campaignProspectId: '43000000-0000-4000-8000-000000000009',
          establishment: {
            ...firstPage.items[0]!.establishment,
            id: '43000000-0000-4000-8000-00000000000a',
            name: 'Not geocoded yet',
            latitude: null,
            longitude: null,
          },
        },
      ],
    });

    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));

    /*
     * An establishment without coordinates cannot be a marker, and saying so
     * is better than silently dropping it from the count.
     */
    expect(await screen.findByText(/1 of 2 plotted/)).toBeInTheDocument();
    expect(screen.getByText(/1 without coordinates/)).toBeInTheDocument();
  });

  it('keeps the list view as the default', async () => {
    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });
});
