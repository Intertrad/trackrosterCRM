/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ActionRecord } from '@/lib/api/action-types';
import type { MembershipSummary } from '@/lib/api/membership-types';

const { listActionsMock, listCampaignsMock } = vi.hoisted(() => ({
  listActionsMock: vi.fn(),
  listCampaignsMock: vi.fn(),
}));

vi.mock('@/lib/api/action-client', () => ({ listActions: listActionsMock }));
vi.mock('@/lib/api/campaign-client', () => ({ listCampaigns: listCampaignsMock }));

import { RecentActivity } from './recent-activity';

const campaignId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const establishmentId = '33333333-3333-4333-8333-333333333333';

function action(over: Partial<ActionRecord> = {}): ActionRecord {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    campaignId,
    campaignProspectId: '55555555-5555-4555-8555-555555555555',
    establishmentId,
    type: 'call',
    subject: 'Interested — Totally Unrelated Free Text',
    status: 'completed',
    outcomeCode: 'interested',
    dueAt: null,
    completedAt: '2026-09-28T14:32:00.000Z',
    actor: { membershipId: memberId, displayName: 'Zain Prospecteur' },
    establishment: { id: establishmentId, name: 'Police Nationale — Paris 15' },
    campaign: { id: campaignId, name: 'September Campaign' },
    organization: { id: 'org-1', name: 'OFTI' },
    ...over,
  };
}

const members: MembershipSummary[] = [
  {
    id: memberId,
    identityId: 'i-1',
    email: 'zain@example.test',
    displayName: 'Zain Prospecteur',
    status: 'active',
    roles: ['prospector'],
    capacity: 100,
  },
];

describe('manager recent activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listActionsMock.mockResolvedValue({ items: [action()], nextCursor: null });
    listCampaignsMock.mockResolvedValue({
      items: [
        {
          id: campaignId,
          tenantId: 't',
          organizationId: 'org-1',
          name: 'September Campaign',
          description: null,
          status: 'active',
          startsAt: null,
          endsAt: null,
        },
      ],
      nextCursor: null,
    });
  });

  afterEach(cleanup);

  /*
   * The question A13 exists to answer: who worked which establishment in which
   * campaign. All three come from the projected relations.
   */
  it('names the prospector, the establishment and the campaign', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() => expect(screen.getByText('Zain Prospecteur')).toBeInTheDocument());

    expect(screen.getByText('Police Nationale — Paris 15')).toBeInTheDocument();
    expect(screen.getByText('OFTI · September Campaign')).toBeInTheDocument();
    /* Channel and outcome in words, not by colour. */
    expect(screen.getByText('call')).toBeInTheDocument();
    expect(screen.getByText('Interested')).toBeInTheDocument();
  });

  /*
   * The establishment comes from the relation, never from `subject`. The fixture's
   * subject deliberately names somewhere else.
   */
  it('reads the establishment from the relation and not from the subject text', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() =>
      expect(screen.getByText('Police Nationale — Paris 15')).toBeInTheDocument(),
    );

    expect(screen.queryByText(/Totally Unrelated Free Text/)).not.toBeInTheDocument();
  });

  it('links across to the establishment record rather than repeating its history', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() => expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      `/admin/prospects/${establishmentId}`,
    );
  });

  /* §21. Narrowing asks the server; it does not sieve a truncated page. */
  it('sends both filters to the server', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() => expect(listActionsMock).toHaveBeenCalled());

    expect(listActionsMock.mock.calls[0]?.[0]).toMatchObject({ limit: 25, status: 'completed' });

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: campaignId } });

    await waitFor(() =>
      expect(listActionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId }),
        expect.anything(),
      ),
    );

    fireEvent.change(screen.getByLabelText('Prospector'), { target: { value: memberId } });

    await waitFor(() =>
      expect(listActionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeMembershipId: memberId }),
        expect.anything(),
      ),
    );
  });

  it('sends nothing that could widen the authorized scope', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() => expect(listActionsMock).toHaveBeenCalled());

    /* Scope is the API's, from the session; no parameter here can reach past it. */
    const sent = listActionsMock.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(sent).not.toHaveProperty('teamId');
    expect(sent).not.toHaveProperty('organizationId');
    expect(sent).not.toHaveProperty('tenantId');
  });

  it('separates an empty filter from an empty period', async () => {
    listActionsMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<RecentActivity members={members} />);

    await waitFor(() =>
      expect(screen.getByText('No activity has been recorded yet.')).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: campaignId } });

    await waitFor(() =>
      expect(screen.getByText('No activity matches these filters.')).toBeInTheDocument(),
    );
  });

  it('refetches on demand rather than through a socket', async () => {
    render(<RecentActivity members={members} />);

    await waitFor(() => expect(listActionsMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    /* A manager reading this a few times a day is the whole freshness requirement. */
    await waitFor(() => expect(listActionsMock).toHaveBeenCalledTimes(2));
  });

  it('keeps the filter usable when the campaign list cannot be read', async () => {
    listCampaignsMock.mockRejectedValue(new Error('campaigns unavailable'));

    render(<RecentActivity members={members} />);

    /* The feed is what matters; losing the filter's options must not cost it. */
    await waitFor(() => expect(screen.getByText('Zain Prospecteur')).toBeInTheDocument());

    expect(screen.getByRole('option', { name: 'All campaigns' })).toBeInTheDocument();
  });

  it('shows a skeleton while loading and a retry when it fails', async () => {
    listActionsMock.mockReturnValueOnce(new Promise(() => {}));

    const { unmount } = render(<RecentActivity members={members} />);

    expect(screen.getByText('Loading recent activity')).toBeInTheDocument();

    unmount();

    listActionsMock.mockRejectedValueOnce(new Error('network'));

    render(<RecentActivity members={members} />);

    await waitFor(() =>
      expect(screen.getByText('We could not load recent activity.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Zain Prospecteur')).toBeInTheDocument());
  });

  it('leaks nothing when the activity is refused', async () => {
    listActionsMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<RecentActivity members={members} />);

    await waitFor(() =>
      expect(screen.getByText('You do not have access to this activity.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('names an unnamed prospector rather than printing an id', async () => {
    listActionsMock.mockResolvedValue({
      items: [action({ actor: { membershipId: memberId, displayName: null } })],
      nextCursor: null,
    });

    render(<RecentActivity members={members} />);

    await waitFor(() => expect(screen.getByText('Unnamed prospector')).toBeInTheDocument());

    expect(screen.queryByText(memberId)).not.toBeInTheDocument();
  });
});
