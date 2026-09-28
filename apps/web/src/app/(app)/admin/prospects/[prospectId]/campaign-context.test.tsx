/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ProspectCampaignMembership } from '@/lib/api/prospect-types';

const { listProspectCampaignMembershipsMock } = vi.hoisted(() => ({
  listProspectCampaignMembershipsMock: vi.fn(),
}));

vi.mock('@/lib/api/prospect-client', () => ({
  listProspectCampaignMemberships: listProspectCampaignMembershipsMock,
}));

import { CampaignContext } from './campaign-context';

const prospectId = '44444444-4444-4444-8444-444444444444';

function membership(over: Partial<ProspectCampaignMembership> = {}): ProspectCampaignMembership {
  return {
    campaignProspectId: '55555555-5555-4555-8555-555555555555',
    campaign: { id: 'campaign-1', name: 'Gendarmeries Île-de-France', status: 'active' },
    organization: { id: 'org-1', name: 'OFTI' },
    membership: {
      status: 'active',
      lifecycleStage: 'contact_made',
      includedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    },
    assignment: {
      id: 'assignment-1',
      status: 'active',
      priority: 'normal',
      assignedAt: '2026-09-10T00:00:00.000Z',
      teamId: 'team-1',
      teamName: 'Paris Team',
      assignedUserId: 'member-1',
      assignedUserName: 'Zain',
    },
    latestActivity: { id: 'activity-1', type: 'call', occurredAt: '2026-09-26T10:42:00.000Z' },
    nextFollowUp: {
      id: 'follow-up-1',
      dueAt: '2026-09-30T09:00:00.000Z',
      category: 'follow_up',
      status: 'pending',
    },
    ...over,
  };
}

describe('prospecting context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProspectCampaignMembershipsMock.mockResolvedValue({ items: [membership()] });
  });

  afterEach(cleanup);

  it('shows the organization, campaign, assignee, last action and next follow-up', async () => {
    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() => expect(screen.getByText('OFTI')).toBeInTheDocument());

    expect(screen.getByText('Gendarmeries Île-de-France')).toBeInTheDocument();
    expect(screen.getByText('Zain · Paris Team')).toBeInTheDocument();
    expect(screen.getByText(/^call · /)).toBeInTheDocument();
    expect(screen.getByText(/follow up$/)).toBeInTheDocument();
    expect(screen.getByText('contact made')).toBeInTheDocument();
  });

  /*
   * Central to the multi-entity design: the same establishment held by two entities
   * is two memberships, not a conflict and not one merged status.
   */
  it('keeps two organizations separate rather than collapsing them', async () => {
    listProspectCampaignMembershipsMock.mockResolvedValue({
      items: [
        membership(),
        membership({
          campaignProspectId: '66666666-6666-4666-8666-666666666666',
          campaign: { id: 'campaign-2', name: 'Douanes Grand Est', status: 'active' },
          organization: { id: 'org-2', name: 'GFTIJ' },
          assignment: null,
          latestActivity: null,
          nextFollowUp: null,
        }),
      ],
    });

    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() => expect(screen.getByText('OFTI')).toBeInTheDocument());

    expect(screen.getByText('GFTIJ')).toBeInTheDocument();
    expect(screen.getByText('Douanes Grand Est')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows an unworked membership as not yet rather than borrowing another row', async () => {
    listProspectCampaignMembershipsMock.mockResolvedValue({
      items: [membership({ assignment: null, latestActivity: null, nextFollowUp: null })],
    });

    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() => expect(screen.getByText('OFTI')).toBeInTheDocument());

    /* Assigned to, last action and next follow-up all unknown. */
    expect(screen.getAllByText('Not yet')).toHaveLength(3);
  });

  it('shows an excluded membership instead of hiding it', async () => {
    listProspectCampaignMembershipsMock.mockResolvedValue({
      items: [membership({ membership: { ...membership().membership, status: 'excluded' } })],
    });

    render(<CampaignContext prospectId={prospectId} />);

    /* Somebody excluded it on purpose; bulk enrolment leaves it that way. */
    await waitFor(() => expect(screen.getByText('excluded')).toBeInTheDocument());
  });

  it('says so plainly when no campaign holds the establishment', async () => {
    listProspectCampaignMembershipsMock.mockResolvedValue({ items: [] });

    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() =>
      expect(
        screen.getByText('This establishment has not yet been enrolled in a campaign.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows a section skeleton rather than blocking on the whole page', async () => {
    listProspectCampaignMembershipsMock.mockReturnValue(new Promise(() => {}));

    render(<CampaignContext prospectId={prospectId} />);

    expect(screen.getByText('Loading the prospecting context')).toBeInTheDocument();
  });

  it('offers a retry when the section fails, and recovers', async () => {
    listProspectCampaignMembershipsMock.mockRejectedValueOnce(new Error('network'));

    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() =>
      expect(screen.getByText('Unable to load prospecting context.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('OFTI')).toBeInTheDocument());
  });

  it('leaks no membership information when access is refused', async () => {
    listProspectCampaignMembershipsMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() => expect(screen.getByText(/do not have access/)).toBeInTheDocument());

    expect(screen.queryByText('OFTI')).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  /*
   * The bridge TR-930 exists for: the membership carries the campaignProspectId
   * that the existing campaign-scoped activity and follow-up endpoints need, so no
   * establishment-level duplicate of them has to be invented.
   */
  it('exposes the campaign-prospect id the scoped endpoints key on', async () => {
    render(<CampaignContext prospectId={prospectId} />);

    await waitFor(() => expect(screen.getByText('OFTI')).toBeInTheDocument());

    const [first] = (await listProspectCampaignMembershipsMock.mock.results[0]!.value)
      .items as ProspectCampaignMembership[];

    expect(first!.campaignProspectId).toBe('55555555-5555-4555-8555-555555555555');
    expect(first!.campaign.id).toBe('campaign-1');
  });
});
