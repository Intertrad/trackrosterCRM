/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import type { Assignment } from '@/lib/api/assignment-lifecycle-types';

const {
  listAssignmentsMock,
  updateAssignmentMock,
  reassignAssignmentMock,
  completeAssignmentMock,
  revokeAssignmentMock,
  listMembershipsMock,
} = vi.hoisted(() => ({
  listAssignmentsMock: vi.fn(),
  updateAssignmentMock: vi.fn(),
  reassignAssignmentMock: vi.fn(),
  completeAssignmentMock: vi.fn(),
  revokeAssignmentMock: vi.fn(),
  listMembershipsMock: vi.fn(),
}));

vi.mock('@/lib/api/assignment-lifecycle-client', () => ({
  listAssignments: listAssignmentsMock,
  updateAssignment: updateAssignmentMock,
  reassignAssignment: reassignAssignmentMock,
  completeAssignment: completeAssignmentMock,
  revokeAssignment: revokeAssignmentMock,
}));

vi.mock('@/lib/api/membership-client', () => ({ listScopedMemberships: listMembershipsMock }));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    activeWorkspace: { teamId: 'team-1' },
  }),
}));

import ActiveAssignmentsPage from './page';

const assignment: Assignment = {
  id: 'assignment-1',
  tenantId: 'tenant-1',
  campaignId: 'campaign-1',
  campaignProspectId: 'prospect-1',
  prospectName: 'Nancy Central Police Station',
  organizationId: 'org-1',
  teamId: 'team-1',
  assignedUserId: 'user-1',
  assignedAt: '2026-09-28T08:00:00.000Z',
  endedAt: null,
  status: 'active',
  priority: 'normal',
  endReason: null,
  updatedAt: '2026-09-28T08:00:00.000Z',
  etag: '"v1"',
};

function renderPage() {
  return render(<ActiveAssignmentsPage />);
}

describe('active assignment lifecycle controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAssignmentsMock.mockResolvedValue({ items: [assignment], nextCursor: null });
    listMembershipsMock.mockResolvedValue({
      items: [
        {
          id: 'user-1',
          identityId: 'identity-1',
          email: 'camille@example.test',
          displayName: 'Camille Roux',
          status: 'active',
          roles: ['prospector'],
          capacity: 20,
        },
      ],
      nextCursor: null,
    });
    updateAssignmentMock.mockResolvedValue({ ...assignment, status: 'paused' });
    reassignAssignmentMock.mockResolvedValue({ ...assignment, assignedUserId: null });
    completeAssignmentMock.mockResolvedValue({
      ...assignment,
      status: 'completed',
      endedAt: '2026-09-29T08:00:00.000Z',
    });
    revokeAssignmentMock.mockResolvedValue({
      ...assignment,
      status: 'revoked',
      endedAt: '2026-09-29T08:00:00.000Z',
    });
  });

  afterEach(cleanup);

  it('loads the team-scoped list and sends pause with the current ETag', async () => {
    renderPage();

    expect(await screen.findByText('Nancy Central Police Station')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() =>
      expect(updateAssignmentMock).toHaveBeenCalledWith(
        'assignment-1',
        { status: 'paused' },
        expect.objectContaining({ etag: '"v1"', idempotencyKey: expect.any(String) }),
      ),
    );
    expect(listAssignmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1', status: 'active', limit: 100 }),
      expect.anything(),
    );
  });

  it('keeps lifecycle counters independent from the selected status filter', async () => {
    const paused = { ...assignment, id: 'assignment-paused', status: 'paused' as const };
    const completed = {
      ...assignment,
      id: 'assignment-completed',
      status: 'completed' as const,
      endedAt: '2026-09-29T08:00:00.000Z',
    };

    listAssignmentsMock.mockImplementation((query: { status?: string }) =>
      Promise.resolve({
        items: query.status === 'active' ? [assignment] : [assignment, paused, completed],
        nextCursor: null,
      }),
    );

    renderPage();

    expect(await screen.findByText('Nancy Central Police Station')).toBeInTheDocument();
    expect(screen.getAllByText('Paused')[0]?.parentElement).toHaveTextContent('1');
    expect(screen.getAllByText('Completed')[0]?.parentElement).toHaveTextContent('1');
    expect(screen.getByText('Shown').parentElement).toHaveTextContent('1');
  });

  it('requires a different owner before submitting a reassign', async () => {
    renderPage();

    await screen.findByText('Nancy Central Police Station');
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }));
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Move to the shared team queue' },
    });

    const submit = screen.getAllByRole('button', { name: 'Reassign' }).at(-1)!;
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: '' } });
    expect(submit).toBeEnabled();
  });

  it('refreshes the visible row and counters after pausing', async () => {
    const paused = { ...assignment, status: 'paused' as const };
    let request = 0;
    listAssignmentsMock.mockImplementation(() => {
      request += 1;

      if (request === 1) {
        return Promise.resolve({ items: [assignment], nextCursor: null });
      }

      if (request === 2) {
        return Promise.resolve({ items: [assignment], nextCursor: null });
      }

      if (request === 3) {
        return Promise.resolve({ items: [], nextCursor: null });
      }

      return Promise.resolve({ items: [paused], nextCursor: null });
    });

    renderPage();
    await screen.findByText('Nancy Central Police Station');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(await screen.findByText('Assignment paused.')).toBeInTheDocument();
    expect(screen.getAllByText('Active')[0]?.parentElement).toHaveTextContent('0');
    expect(screen.getAllByText('Paused')[0]?.parentElement).toHaveTextContent('1');
    expect(screen.queryByText('Nancy Central Police Station')).not.toBeInTheDocument();
  });

  it.each([
    ['reassigns', 'Reassign', 'Assignment moved.', reassignAssignmentMock],
    ['completes', 'Complete', 'Assignment completed.', completeAssignmentMock],
    ['revokes', 'Revoke', 'Assignment revoked.', revokeAssignmentMock],
  ])(
    '%s an assignment through its reason drawer',
    async (_name, rowAction, success, actionMock) => {
      renderPage();

      await screen.findByText('Nancy Central Police Station');
      fireEvent.click(screen.getByRole('button', { name: rowAction }));

      const reason = screen.getByLabelText('Reason');
      fireEvent.change(reason, { target: { value: 'Lifecycle verification' } });

      if (rowAction === 'Reassign') {
        /* The current owner is preselected; choose team ownership for a valid target change. */
        fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: '' } });
      }

      const submitName = rowAction === 'Reassign' ? 'Reassign' : `${rowAction} assignment`;
      fireEvent.click(
        rowAction === 'Reassign'
          ? screen.getAllByRole('button', { name: submitName }).at(-1)!
          : screen.getByRole('button', { name: submitName }),
      );

      await waitFor(() => expect(actionMock).toHaveBeenCalled());
      expect(screen.getByText(success)).toBeInTheDocument();

      const options = actionMock.mock.calls[0]?.[2] ?? actionMock.mock.calls[0]?.[1];
      expect(options).toEqual(
        expect.objectContaining({ etag: '"v1"', idempotencyKey: expect.any(String) }),
      );
    },
  );
});

describe('active assignment recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMembershipsMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(cleanup);

  it('keeps the last list visible and offers retry after a refresh failure', async () => {
    listAssignmentsMock
      .mockResolvedValueOnce({ items: [assignment], nextCursor: null })
      .mockResolvedValueOnce({ items: [assignment], nextCursor: null })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ items: [assignment], nextCursor: null })
      .mockResolvedValueOnce({ items: [assignment], nextCursor: null });

    renderPage();
    expect(await screen.findByText('Nancy Central Police Station')).toBeInTheDocument();

    /* The live refresh hook is what re-reads an already visible page. */
    fireEvent.focus(window);

    await waitFor(() =>
      expect(
        screen.getByText(
          'We could not refresh assignments. Check the API connection and try again.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('Nancy Central Police Station')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(
        screen.queryByText(
          'We could not refresh assignments. Check the API connection and try again.',
        ),
      ).not.toBeInTheDocument(),
    );
  });
});
