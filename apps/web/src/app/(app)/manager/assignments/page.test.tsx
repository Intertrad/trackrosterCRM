/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import type { UnassignedProspect } from '@/lib/api/assignment-types';

const {
  useAuthMock,
  getWorkQueueOptionsMock,
  listCampaignsMock,
  listTeamsMock,
  listMembershipsMock,
  getManagerDashboardMock,
  listUnassignedProspectsMock,
  previewAssignmentMock,
  applyAssignmentMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getWorkQueueOptionsMock: vi.fn(),
  listCampaignsMock: vi.fn(),
  listTeamsMock: vi.fn(),
  listMembershipsMock: vi.fn(),
  getManagerDashboardMock: vi.fn(),
  listUnassignedProspectsMock: vi.fn(),
  previewAssignmentMock: vi.fn(),
  applyAssignmentMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/api/work-queue-client', () => ({ getWorkQueueOptions: getWorkQueueOptionsMock }));
vi.mock('@/lib/api/membership-client', () => ({ listMemberships: listMembershipsMock }));
vi.mock('@/lib/api/campaign-client', () => ({ listCampaigns: listCampaignsMock }));
vi.mock('@/lib/api/team-client', () => ({ listTeams: listTeamsMock }));
vi.mock('@/lib/api/manager-dashboard-client', () => ({
  getManagerDashboard: getManagerDashboardMock,
}));
vi.mock('@/lib/api/assignment-client', () => ({
  listUnassignedProspects: listUnassignedProspectsMock,
  previewAssignment: previewAssignmentMock,
  applyAssignment: applyAssignmentMock,
}));

import AssignmentsPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';
const campaignId = '22222222-2222-4222-8222-222222222222';
const memberId = '33333333-3333-4333-8333-333333333333';

function prospect(over: Partial<UnassignedProspect> = {}): UnassignedProspect {
  return {
    campaignProspectId: `44444444-4444-4444-8444-${String(Math.random()).slice(2, 14)}`,
    campaignId,
    establishmentId: '55555555-5555-4555-8555-555555555555',
    name: 'Brigade de Bastia',
    category: 'prospection',
    city: 'Bastia',
    postalCode: '20200',
    department: '20',
    regionId: null,
    latitude: null,
    longitude: null,
    lifecycleStage: 'to_contact',
    contactBlocked: false,
    activeElsewhere: false,
    ...over,
  };
}

describe('manager assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      activeWorkspace: {
        key: 'team:manager:o:t',
        mode: 'manager' as const,
        role: 'manager' as const,
        scopeType: 'team' as const,
        organizationId: 'o',
        teamId,
      },
    });

    getWorkQueueOptionsMock.mockResolvedValue({
      campaigns: [{ id: campaignId, name: 'Gendarmeries 2026' }],
    });

    listMembershipsMock.mockResolvedValue({
      items: [
        {
          id: memberId,
          identityId: '66666666-6666-4666-8666-666666666666',
          email: 'amel.diallo@example.test',
          displayName: 'Amel Diallo',
          status: 'active' as const,
          roles: ['prospector'],
          capacity: 120,
        },
      ],
      nextCursor: null,
    });

    getManagerDashboardMock.mockResolvedValue(null);

    listUnassignedProspectsMock.mockResolvedValue({
      items: [prospect()],
      nextCursor: null,
    });

    previewAssignmentMock.mockResolvedValue({
      campaignId,
      ruleId: null,
      mode: 'preview',
      canApply: true,
      assigned: 0,
      proposed: 1,
      conflicts: 0,
      decisions: [{ prospectId: 'p', outcome: 'proposed' }],
    });

    applyAssignmentMock.mockResolvedValue({
      campaignId,
      ruleId: null,
      mode: 'apply',
      canApply: true,
      assigned: 1,
      proposed: 1,
      conflicts: 0,
      decisions: [{ prospectId: 'p', outcome: 'proposed' }],
    });
  });

  afterEach(cleanup);

  /*
   * These filters belong to TR-923 and are applied by the database. The base is
   * over 14,000 establishments and a page holds 100, so a filter applied in the
   * browser would search the page and report nothing for the rest — which is what
   * this page used to do.
   */
  it('sends the section and department filters to the server', async () => {
    render(<AssignmentsPage />);

    await waitFor(() => expect(listUnassignedProspectsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });

    await waitFor(() =>
      expect(listUnassignedProspectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId, teamId, category: 'cra' }),
        expect.anything(),
      ),
    );

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '974' } });

    await waitFor(() =>
      expect(listUnassignedProspectsMock).toHaveBeenCalledWith(
        expect.objectContaining({ department: '974' }),
        expect.anything(),
      ),
    );
  });

  it('shows the backend decisions it cannot compute itself', async () => {
    listUnassignedProspectsMock.mockResolvedValue({
      items: [
        prospect({ name: 'Opposé', contactBlocked: true }),
        prospect({ name: 'Ailleurs', activeElsewhere: true }),
      ],
      nextCursor: null,
    });

    render(<AssignmentsPage />);

    await waitFor(() => expect(screen.getByText('Opposition')).toBeInTheDocument());
    expect(screen.getByText('Active elsewhere')).toBeInTheDocument();
  });

  /* The flow TR-925 must not break. */
  it('still previews and applies a batch through the existing endpoints', async () => {
    render(<AssignmentsPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Select Brigade de Bastia'));

    fireEvent.click(screen.getByRole('button', { name: /Preview 1 prospect/ }));

    await waitFor(() => expect(previewAssignmentMock).toHaveBeenCalledTimes(1));

    expect(previewAssignmentMock.mock.calls[0]?.[0]).toMatchObject({
      campaignId,
      teamId,
      assignedUserId: memberId,
    });

    /* Applying is gated on the server's own canApply, never on a local guess. */
    fireEvent.click(screen.getByRole('button', { name: /Assign 1 prospect/ }));

    await waitFor(() => expect(applyAssignmentMock).toHaveBeenCalledTimes(1));

    /* An idempotency key, so a retry cannot assign the batch twice. */
    expect(applyAssignmentMock.mock.calls[0]?.[1]).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/1 prospect assigned/)).toBeInTheDocument());
  });

  it('refuses to apply while the server reports an unresolved conflict', async () => {
    previewAssignmentMock.mockResolvedValue({
      campaignId,
      ruleId: null,
      mode: 'preview',
      canApply: false,
      assigned: 0,
      proposed: 0,
      conflicts: 1,
      decisions: [{ prospectId: 'p', outcome: 'already_assigned' }],
    });

    render(<AssignmentsPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Select Brigade de Bastia'));
    fireEvent.click(screen.getByRole('button', { name: /Preview 1 prospect/ }));

    await waitFor(() =>
      expect(screen.getByText(/Resolve the conflicts above before assigning/)).toBeInTheDocument(),
    );

    /*
     * Anti-collision is the server's. The button is disabled because the server
     * said so, not because the page decided the prospect was taken.
     */
    expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
    expect(applyAssignmentMock).not.toHaveBeenCalled();
  });

  it('tells a scoped workspace without a team why the page is empty rather than failing', async () => {
    useAuthMock.mockReturnValue({
      activeWorkspace: {
        key: 'organization:observer:o:-',
        mode: 'observer' as const,
        role: 'observer' as const,
        scopeType: 'organization' as const,
        organizationId: 'o',
        teamId: null,
      },
    });

    render(<AssignmentsPage />);

    expect(screen.getByText('This view is scoped to a team.')).toBeInTheDocument();
  });
});

/*
 * TR-926. A tenant-scoped administrator has no workspace team, and this page used
 * to read that as "cannot dispatch". The API never said so: authorizeBatch admits
 * a client_admin, and its targets() then requires the team to belong to the
 * campaign's organization. So the administrator names the team and the backend
 * behaves as it already did.
 */
describe('admin dispatch with an explicit target team', () => {
  const organizationId = '77777777-7777-4777-8777-777777777777';
  const otherOrganizationId = '88888888-8888-4888-8888-888888888888';
  const teamA = '99999999-9999-4999-8999-999999999999';
  const teamB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherCampaignId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  function team(id: string, name: string, orgId = organizationId) {
    return {
      id,
      tenantId: 't',
      organizationId: orgId,
      name,
      status: 'active' as const,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      activeWorkspace: {
        key: 'tenant:client_admin:-:-',
        mode: 'admin' as const,
        role: 'client_admin' as const,
        scopeType: 'tenant' as const,
        organizationId: null,
        teamId: null,
      },
    });

    listCampaignsMock.mockResolvedValue({
      items: [
        {
          id: campaignId,
          tenantId: 't',
          organizationId,
          name: 'Gendarmeries 2026',
          description: null,
          status: 'active',
          startsAt: null,
          endsAt: null,
        },
        {
          id: otherCampaignId,
          tenantId: 't',
          organizationId: otherOrganizationId,
          name: 'Zebra campaign',
          description: null,
          status: 'active',
          startsAt: null,
          endsAt: null,
        },
      ],
      nextCursor: null,
    });

    listTeamsMock.mockResolvedValue({
      items: [team(teamA, 'Paris Field Team'), team(teamB, 'Lyon Field Team')],
      nextCursor: null,
    });

    listMembershipsMock.mockResolvedValue({
      items: [
        {
          id: memberId,
          identityId: '66666666-6666-4666-8666-666666666666',
          email: 'amel.diallo@example.test',
          displayName: 'Amel Diallo',
          status: 'active' as const,
          roles: ['prospector'],
          capacity: 120,
        },
      ],
      nextCursor: null,
    });

    getManagerDashboardMock.mockResolvedValue(null);
    listUnassignedProspectsMock.mockResolvedValue({ items: [prospect()], nextCursor: null });

    previewAssignmentMock.mockResolvedValue({
      campaignId,
      ruleId: null,
      mode: 'preview',
      canApply: true,
      assigned: 0,
      proposed: 1,
      conflicts: 0,
      decisions: [{ prospectId: 'p', outcome: 'proposed' }],
    });

    applyAssignmentMock.mockResolvedValue({
      campaignId,
      ruleId: null,
      mode: 'apply',
      canApply: true,
      assigned: 1,
      proposed: 1,
      conflicts: 0,
      decisions: [{ prospectId: 'p', outcome: 'proposed' }],
    });
  });

  afterEach(cleanup);

  async function selectProspect(): Promise<void> {
    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Select Brigade de Bastia'));
  }

  it('renders the workflow and offers a target team instead of refusing the page', async () => {
    render(<AssignmentsPage />);

    await waitFor(() => expect(screen.getByLabelText('Target team')).toBeInTheDocument());

    expect(screen.queryByText('This view is scoped to a team.')).not.toBeInTheDocument();

    /*
     * Campaigns come from the campaign list, not the work queue: the work-queue
     * options are the caller's own assignments, and an administrator has none —
     * so that source is always empty for this role.
     */
    expect(listCampaignsMock).toHaveBeenCalled();
    expect(getWorkQueueOptionsMock).not.toHaveBeenCalled();
  });

  it('offers only the teams of the chosen campaign organization', async () => {
    render(<AssignmentsPage />);

    await waitFor(() => expect(listTeamsMock).toHaveBeenCalled());

    /*
     * Upstream targets() answers 400 for a team outside the campaign's
     * organization. Mirroring that rule means the impossible choice is not
     * offered; the API is still the authority on it.
     */
    expect(listTeamsMock.mock.calls[0]?.[0]).toMatchObject({ organizationId });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Field Team' })).toBeInTheDocument(),
    );

    /* Never pre-selected: dispatching a batch into the wrong team is real work lost. */
    expect(screen.getByLabelText<HTMLSelectElement>('Target team').value).toBe('');
  });

  it('will not preview without a target team, and says so rather than doing nothing', async () => {
    render(<AssignmentsPage />);

    await selectProspect();

    await waitFor(() =>
      expect(
        screen.getByText('Select a target team before previewing assignments.'),
      ).toBeInTheDocument(),
    );

    expect(screen.getByRole('button', { name: /Preview 1 prospect/ })).toBeDisabled();
    expect(previewAssignmentMock).not.toHaveBeenCalled();
  });

  it('sends the selected team to preview and the same team to apply', async () => {
    render(<AssignmentsPage />);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Field Team' })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Target team'), { target: { value: teamA } });

    await selectProspect();

    fireEvent.click(screen.getByRole('button', { name: /Preview 1 prospect/ }));

    await waitFor(() => expect(previewAssignmentMock).toHaveBeenCalledTimes(1));

    expect(previewAssignmentMock.mock.calls[0]?.[0]).toMatchObject({
      campaignId,
      teamId: teamA,
      assignedUserId: memberId,
    });

    fireEvent.click(screen.getByRole('button', { name: /Assign 1 prospect/ }));

    await waitFor(() => expect(applyAssignmentMock).toHaveBeenCalledTimes(1));

    /*
     * The dangerous failure this guards: previewing against one team and applying
     * to another. Capacity, eligibility and collisions were all judged for the
     * team the preview named.
     */
    expect(applyAssignmentMock.mock.calls[0]?.[0]).toMatchObject({ teamId: teamA });
  });

  it('discards a preview when the target team changes, so it cannot be applied to another team', async () => {
    render(<AssignmentsPage />);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Field Team' })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Target team'), { target: { value: teamA } });

    await selectProspect();

    fireEvent.click(screen.getByRole('button', { name: /Preview 1 prospect/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Assign/ })).toBeEnabled());

    /* The preview is on screen and applicable. */
    expect(screen.getByText('Will be assigned')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Target team'), { target: { value: teamB } });

    /*
     * The decisions belonged to team A. Asserting the preview itself is gone
     * rather than that the button is disabled: the button has several reasons to
     * be disabled, so it would pass even if the stale preview survived.
     */
    await waitFor(() => expect(screen.queryByText('Will be assigned')).not.toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
    expect(applyAssignmentMock).not.toHaveBeenCalled();
  });

  it('asks the roster for the target team, because eligibility is per team', async () => {
    render(<AssignmentsPage />);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Field Team' })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Target team'), { target: { value: teamA } });

    await waitFor(() =>
      expect(listMembershipsMock).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: teamA }),
        expect.anything(),
      ),
    );
  });

  it('keeps the selector unusable while teams load or when there are none', async () => {
    listTeamsMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<AssignmentsPage />);

    await waitFor(() => expect(listTeamsMock).toHaveBeenCalled());

    /* No request may be made with an undefined team. */
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>('Target team')).toBeDisabled(),
    );

    /* FilterSelect also renders the chosen label for screen readers, so query the option. */
    expect(
      screen.getByRole('option', { name: 'No active team in this organization' }),
    ).toBeInTheDocument();
  });

  it('clears the chosen team when the campaign moves to another organization', async () => {
    render(<AssignmentsPage />);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Field Team' })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Target team'), { target: { value: teamA } });

    expect(screen.getByLabelText<HTMLSelectElement>('Target team').value).toBe(teamA);

    listTeamsMock.mockResolvedValue({
      items: [team('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Brussels Team', otherOrganizationId)],
      nextCursor: null,
    });

    fireEvent.change(screen.getByLabelText('Campaign'), { target: { value: otherCampaignId } });

    /*
     * A team legal for one organization is refused for another, so the choice is
     * dropped rather than carried into a request that would be a 400.
     */
    await waitFor(() =>
      expect(listTeamsMock).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: otherOrganizationId }),
        expect.anything(),
      ),
    );

    expect(screen.getByLabelText<HTMLSelectElement>('Target team').value).toBe('');
  });
});
