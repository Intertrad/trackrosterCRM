/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  WorkQueueCampaignOption,
  WorkQueueItem,
  WorkQueueOptionsResponse,
  WorkQueueResponse,
} from '@/lib/api/work-queue-types';

const {
  getWorkQueueOptionsMock,
  listCollisionEventsMock,
  listWorkQueueMock,
  searchParamsMock,
  useAuthMock,
} = vi.hoisted(() => ({
  getWorkQueueOptionsMock: vi.fn(),

  listCollisionEventsMock: vi.fn(),

  listWorkQueueMock: vi.fn(),

  searchParamsMock: vi.fn(() => new URLSearchParams()),

  useAuthMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}));

vi.mock('@/lib/api/collision-client', () => ({
  listCollisionEvents: listCollisionEventsMock,
}));

vi.mock('@/lib/api/work-queue-client', () => ({
  getWorkQueueOptions: getWorkQueueOptionsMock,

  listWorkQueue: listWorkQueueMock,
}));

vi.mock('@/components/prospector/prospect-detail', () => ({
  ProspectDetail: ({
    prospectId,
    onDirtyChange,
  }: {
    prospectId: string;
    onDirtyChange?: (dirty: boolean) => void;
  }) => (
    <div data-testid="prospect-detail-panel">
      Prospect detail {prospectId}
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        Make draft dirty
      </button>
    </div>
  ),
}));

import { I18nProvider } from '@/lib/i18n/i18n-context';

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

describe('WorkQueuePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(fixedNow));

    setProspectorWorkspace();
    listWorkQueueMock.mockResolvedValue(firstPage);
    getWorkQueueOptionsMock.mockResolvedValue(campaignOptions);
    listCollisionEventsMock.mockResolvedValue({ items: [], nextCursor: null });
    searchParamsMock.mockReturnValue(new URLSearchParams());
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

    expect(await screen.findByText('North Star Dental')).toBeInTheDocument();
    expect(screen.getByText('75001 Paris')).toBeInTheDocument();
    /* Also a campaign-filter option, so the row chip is one of several. */
    expect(screen.getAllByText('Autumn outreach').length).toBeGreaterThan(0);
    expect(screen.getByText('Call · yesterday')).toBeInTheDocument();

    expect(listWorkQueueMock).toHaveBeenCalledWith(expect.objectContaining({ teamId, limit: 100 }));
  });

  it('opens prospect details in a side panel while preserving the deep link', async () => {
    render(<MyProspectsPage />);

    const row = await screen.findByRole('link', { name: /North Star Dental/ });

    expect(row).toHaveAttribute('href', `/work-queue/${campaignId}/${prospectId}`);

    fireEvent.click(row);

    expect(await screen.findByRole('dialog', { name: 'North Star Dental' })).toBeInTheDocument();
    expect(screen.getByTestId('prospect-detail-panel')).toHaveTextContent(prospectId);
  });

  it('reads the whole portfolio so its totals are not a page count', async () => {
    /*
     * The API returns no totals, so the screen pages until the queue is
     * exhausted. Counting one page would mean quoting a figure that describes
     * the request rather than the prospector's book of work.
     */
    listWorkQueueMock.mockReset();
    listWorkQueueMock
      .mockResolvedValueOnce({
        items: [queueItem],
        page: { limit: 100, hasMore: true, nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ ...queueItem, campaignProspectId: 'second', lifecycleStage: 'to_contact' }],
        page: { limit: 100, hasMore: false, nextCursor: null },
      });

    render(<MyProspectsPage />);

    expect(await screen.findByText(/2 establishments assigned to me/)).toBeInTheDocument();

    expect(listWorkQueueMock).toHaveBeenCalledTimes(2);
    expect(listWorkQueueMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );

    expect(screen.getByText(/2 assigned · 1 to contact/)).toBeInTheDocument();
  });

  it('says so when the portfolio is larger than it can read in one go', async () => {
    listWorkQueueMock.mockResolvedValue({
      items: [queueItem],
      page: { limit: 100, hasMore: true, nextCursor: 'never-ends' },
    });

    render(<MyProspectsPage />);

    /* Quoting a total for a portfolio that was only partly read would be a
     * number nobody can stand behind. */
    expect(
      await screen.findByText('Showing the first part of your portfolio.'),
    ).toBeInTheDocument();
  });

  it('filters by status without asking the backend again', async () => {
    listWorkQueueMock.mockResolvedValue({
      items: [
        queueItem,
        {
          ...queueItem,
          campaignProspectId: 'to-contact-1',
          lifecycleStage: 'to_contact',
          establishment: { ...queueItem.establishment, name: 'Verdun gendarmerie' },
        },
      ],
      page: { limit: 100, hasMore: false, nextCursor: null },
    });

    render(<MyProspectsPage />);

    await screen.findByText('North Star Dental');

    const calls = listWorkQueueMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'to_contact' } });

    expect(await screen.findByText('Verdun gendarmerie')).toBeInTheDocument();
    expect(screen.queryByText('North Star Dental')).not.toBeInTheDocument();

    /* The whole portfolio is already in hand; refetching would only risk the
     * list and its totals disagreeing. */
    expect(listWorkQueueMock).toHaveBeenCalledTimes(calls);
  });

  it('filters by campaign using the loaded options', async () => {
    getWorkQueueOptionsMock.mockResolvedValue({
      campaigns: [campaignOption, { id: 'other-campaign', name: 'Winter push' }],
    });

    render(<MyProspectsPage />);

    await screen.findByText('North Star Dental');

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: 'other-campaign' } });

    expect(screen.queryByText('North Star Dental')).not.toBeInTheDocument();
    expect(screen.getByText('No prospect matches these filters.')).toBeInTheDocument();
  });

  it('searches the portfolio it already holds', async () => {
    render(<MyProspectsPage />);

    await screen.findByText('North Star Dental');

    const calls = listWorkQueueMock.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Search my portfolio'), {
      target: { value: 'nothing matches this' },
    });

    expect(screen.queryByText('North Star Dental')).not.toBeInTheDocument();
    expect(listWorkQueueMock).toHaveBeenCalledTimes(calls);

    fireEvent.change(screen.getByLabelText('Search my portfolio'), { target: { value: '75001' } });

    expect(screen.getByText('North Star Dental')).toBeInTheDocument();
  });

  it('distinguishes a filtered empty result from an empty portfolio', async () => {
    listWorkQueueMock.mockResolvedValue({
      items: [],
      page: { limit: 100, hasMore: false, nextCursor: null },
    });

    render(<MyProspectsPage />);

    /* "Change the filter" and "you have no work" mean opposite things. */
    expect(await screen.findByText('No prospects are assigned to you yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'qualified' } });

    expect(screen.getByText('No prospect matches these filters.')).toBeInTheDocument();
  });

  it('marks a prospect the collision engine has blocked', async () => {
    listCollisionEventsMock.mockResolvedValue({
      items: [
        { campaignProspectId: prospectId, decision: 'block', reasonCode: 'ACTIVE_RESERVATION' },
      ],
      nextCursor: null,
    });

    render(<MyProspectsPage />);

    /* Blocked outranks every other next step: acting on it is what the
     * anti-collision rule exists to prevent. */
    expect(await screen.findByText('Blocked — cooldown')).toBeInTheDocument();
    expect(screen.getByText(/1 blocked by an anti-collision rule/)).toBeInTheDocument();
  });

  it('surfaces a read failure instead of showing an empty portfolio', async () => {
    listWorkQueueMock.mockRejectedValue(new Error('boom'));

    render(<MyProspectsPage />);

    expect(
      await screen.findByText('We could not load your portfolio. Please try again.'),
    ).toBeInTheDocument();
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
    expect(await screen.findByText(/of 1 visible/)).toBeInTheDocument();
    expect(screen.getByText('1 without coordinates')).toBeInTheDocument();
  });

  it('keeps the list view as the default', async () => {
    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders in French for a French membership, with no message keys left over', async () => {
    render(
      <I18nProvider locale="fr-FR">
        <MyProspectsPage />
      </I18nProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Mes prospects' })).toBeInTheDocument();
    expect(screen.getByText(/1 établissement qui m’est attribué/)).toBeInTheDocument();
    /* Both the status filter and the row badge translate. */
    expect(screen.getAllByText('En cours').length).toBeGreaterThan(1);
    expect(screen.getByText(/Appel · hier/)).toBeInTheDocument();

    /*
     * A key that reaches the DOM type-checks perfectly and reads as gibberish.
     * Nothing else catches it, so the whole rendered page is scanned.
     */
    expect(document.body.textContent).not.toMatch(/\b(portfolio|nav|stage|next|when)\.[a-zA-Z.]+/);
  });

  it('opens already filtered when scoped search links here with a term', async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('search=North%20Star'));

    render(<MyProspectsPage />);

    await screen.findByRole('heading', { name: 'My prospects' });

    expect(screen.getByLabelText('Search my portfolio')).toHaveValue('North Star');

    /* Seeding the box is not enough: the term has to narrow the list, or the
     * link would land on an unfiltered portfolio. */
    expect(screen.getByText('North Star Dental')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search my portfolio'), { target: { value: 'zzz' } });

    expect(screen.queryByText('North Star Dental')).not.toBeInTheDocument();
  });
});
