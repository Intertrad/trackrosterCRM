/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ProspectCampaignMembership } from '@/lib/api/prospect-types';
import type { ProspectTimelineActivityItem } from '@/lib/api/work-queue-types';

const { getCampaignProspectTimelineMock, listMembershipsMock } = vi.hoisted(() => ({
  getCampaignProspectTimelineMock: vi.fn(),
  listMembershipsMock: vi.fn(),
}));

vi.mock('@/lib/api/prospect-client', () => ({
  getCampaignProspectTimeline: getCampaignProspectTimelineMock,
}));
vi.mock('@/lib/api/membership-client', () => ({ listMemberships: listMembershipsMock }));

import { EstablishmentTimeline } from './establishment-timeline';

const ofti = 'org-ofti';
const gftij = 'org-gftij';
const actor = 'member-1';

function membership(
  organizationId: string,
  organizationName: string,
  campaignProspectId: string,
): ProspectCampaignMembership {
  return {
    campaignProspectId,
    campaign: {
      id: `campaign-${organizationId}`,
      name: `Campagne ${organizationName}`,
      status: 'active',
    },
    organization: { id: organizationId, name: organizationName },
    membership: {
      status: 'active',
      lifecycleStage: 'contact_made',
      includedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    assignment: null,
    latestActivity: null,
    nextFollowUp: null,
  };
}

function activity(
  id: string,
  occurredAt: string,
  activityType: ProspectTimelineActivityItem['activityType'] = 'call',
): ProspectTimelineActivityItem {
  return {
    kind: 'activity',
    id,
    occurredAt,
    activityType,
    actor: { userId: actor },
    context: {
      campaignId: 'campaign-x',
      campaignProspectId: 'cp-x',
      establishmentId: 'est-1',
      assignmentId: 'assignment-1',
    },
  };
}

const roster = {
  items: [
    {
      id: actor,
      identityId: 'identity-1',
      email: 'zain@example.test',
      displayName: 'Zain',
      status: 'active' as const,
      roles: ['prospector'],
      capacity: 100,
    },
  ],
  nextCursor: null,
};

describe('establishment activity history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMembershipsMock.mockResolvedValue(roster);
    getCampaignProspectTimelineMock.mockResolvedValue({
      items: [activity('a-1', '2026-09-26T10:42:00.000Z')],
      nextCursor: null,
    });
  });

  afterEach(cleanup);

  it('renders one membership history with its channel and actor', async () => {
    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() => expect(screen.getByText('call')).toBeInTheDocument());

    /* The channel is stated, not conveyed by the icon alone. */
    expect(screen.getByText(/OFTI · Campagne OFTI · Zain/)).toBeInTheDocument();
  });

  /*
   * §6: fan-out is one bounded request per visible membership plus one roster read
   * for actor names. It grows with the number of campaigns holding the
   * establishment — a handful — not with the size of the history.
   */
  it('makes one bounded request per membership and no more', async () => {
    render(
      <EstablishmentTimeline
        memberships={[membership(ofti, 'OFTI', 'cp-1'), membership(gftij, 'GFTIJ', 'cp-2')]}
      />,
    );

    await waitFor(() => expect(getCampaignProspectTimelineMock).toHaveBeenCalledTimes(2));

    expect(listMembershipsMock).toHaveBeenCalledTimes(1);

    for (const call of getCampaignProspectTimelineMock.mock.calls) {
      expect(call[2]).toMatchObject({ limit: 20 });
    }
  });

  it('merges two entities chronologically while keeping their origin', async () => {
    getCampaignProspectTimelineMock.mockImplementation((campaignId: string) =>
      Promise.resolve(
        campaignId === `campaign-${ofti}`
          ? { items: [activity('older', '2026-09-20T08:00:00.000Z', 'email')], nextCursor: null }
          : { items: [activity('newer', '2026-09-26T10:42:00.000Z', 'visit')], nextCursor: null },
      ),
    );

    render(
      <EstablishmentTimeline
        memberships={[membership(ofti, 'OFTI', 'cp-1'), membership(gftij, 'GFTIJ', 'cp-2')]}
      />,
    );

    await waitFor(() => expect(screen.getByText('visit')).toBeInTheDocument());

    const rows = screen.getAllByRole('listitem');

    /* Newest first, across entities, on the activity's own timestamp. */
    expect(rows[0]).toHaveTextContent('visit');
    expect(rows[0]).toHaveTextContent('GFTIJ');
    expect(rows[1]).toHaveTextContent('email');
    expect(rows[1]).toHaveTextContent('OFTI');
  });

  it('builds the entity filter from what came back, not a fixed list', async () => {
    render(
      <EstablishmentTimeline
        memberships={[membership(ofti, 'OFTI', 'cp-1'), membership(gftij, 'GFTIJ', 'cp-2')]}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Entity')).toBeInTheDocument());

    expect(screen.getByRole('option', { name: 'OFTI' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GFTIJ' })).toBeInTheDocument();
    /* No entity the establishment is not enrolled with. */
    expect(screen.queryByRole('option', { name: 'INTERTRAD' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Entity'), { target: { value: gftij } });

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  });

  it('offers no entity filter for a single membership', async () => {
    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() => expect(screen.getByText('call')).toBeInTheDocument());

    expect(screen.queryByLabelText('Entity')).not.toBeInTheDocument();
  });

  /* Three different statements that must not look alike. */
  it('separates no membership from no activity', async () => {
    const { unmount } = render(<EstablishmentTimeline memberships={[]} />);

    expect(screen.getByText(/No campaign holds this establishment/)).toBeInTheDocument();
    expect(getCampaignProspectTimelineMock).not.toHaveBeenCalled();

    unmount();

    getCampaignProspectTimelineMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() =>
      expect(screen.getByText(/enrolled but nothing has been recorded/)).toBeInTheDocument(),
    );
  });

  it('names the entity whose history is missing and keeps the rest', async () => {
    getCampaignProspectTimelineMock.mockImplementation((campaignId: string) =>
      campaignId === `campaign-${gftij}`
        ? Promise.reject(new Error('timeline unavailable'))
        : Promise.resolve({
            items: [activity('a-1', '2026-09-26T10:42:00.000Z')],
            nextCursor: null,
          }),
    );

    render(
      <EstablishmentTimeline
        memberships={[membership(ofti, 'OFTI', 'cp-1'), membership(gftij, 'GFTIJ', 'cp-2')]}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('History is missing for GFTIJ.')).toBeInTheDocument(),
    );

    /*
     * One failed membership must not erase the histories that loaded, and the gap
     * has to be named — otherwise an incomplete history reads as a complete one.
     */
    expect(screen.getByText('call')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('says so plainly when every history fails, and retries', async () => {
    getCampaignProspectTimelineMock.mockRejectedValueOnce(new Error('down'));

    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() =>
      expect(screen.getByText('The activity history could not be loaded.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('call')).toBeInTheDocument());
  });

  it('treats a refused membership as a missing history rather than crashing', async () => {
    getCampaignProspectTimelineMock.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'not found',
        error: 'Not Found',
      }),
    );

    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    /*
     * The API masks a forbidden campaign prospect as 404, so a membership the
     * caller may not read looks exactly like one that is not there — which is the
     * non-disclosure working, and the section must not reveal the difference.
     */
    await waitFor(() =>
      expect(screen.getByText('The activity history could not be loaded.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('discloses that the page is bounded when more history exists', async () => {
    getCampaignProspectTimelineMock.mockResolvedValue({
      items: [activity('a-1', '2026-09-26T10:42:00.000Z')],
      nextCursor: 'more',
    });

    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() =>
      expect(screen.getByText(/20 most recent events per campaign/)).toBeInTheDocument(),
    );
  });

  it('renders an event even when the actor cannot be named', async () => {
    listMembershipsMock.mockRejectedValue(new Error('roster unavailable'));

    render(<EstablishmentTimeline memberships={[membership(ofti, 'OFTI', 'cp-1')]} />);

    await waitFor(() => expect(screen.getByText('call')).toBeInTheDocument());

    /* A raw uuid is worse than no name at all. */
    expect(screen.queryByText(new RegExp(actor))).not.toBeInTheDocument();
    expect(screen.getByText('OFTI · Campagne OFTI')).toBeInTheDocument();
  });
});
