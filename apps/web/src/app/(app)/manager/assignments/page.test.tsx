/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import type { UnassignedProspect } from '@/lib/api/assignment-types';

const {
  useAuthMock,
  getWorkQueueOptionsMock,
  listMembershipsMock,
  getManagerDashboardMock,
  listUnassignedProspectsMock,
  previewAssignmentMock,
  applyAssignmentMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  getWorkQueueOptionsMock: vi.fn(),
  listMembershipsMock: vi.fn(),
  getManagerDashboardMock: vi.fn(),
  listUnassignedProspectsMock: vi.fn(),
  previewAssignmentMock: vi.fn(),
  applyAssignmentMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/api/work-queue-client', () => ({ getWorkQueueOptions: getWorkQueueOptionsMock }));
vi.mock('@/lib/api/membership-client', () => ({ listMemberships: listMembershipsMock }));
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

  it('tells a workspace without a team why the page is empty rather than failing', async () => {
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

    render(<AssignmentsPage />);

    expect(screen.getByText('This view is scoped to a team.')).toBeInTheDocument();
  });
});
