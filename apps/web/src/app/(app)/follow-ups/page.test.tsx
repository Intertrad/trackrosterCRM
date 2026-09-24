/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { FollowUpQueueItem } from '@/lib/api/follow-up-types';

const {
  useAuthMock,
  listFollowUpQueueMock,
  completeProspectFollowUpMock,
  rescheduleProspectFollowUpMock,
  cancelProspectFollowUpMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),

  listFollowUpQueueMock: vi.fn(),

  completeProspectFollowUpMock: vi.fn(),

  rescheduleProspectFollowUpMock: vi.fn(),

  cancelProspectFollowUpMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/api/follow-up-client', () => ({
  listFollowUpQueue: listFollowUpQueueMock,

  completeProspectFollowUp: completeProspectFollowUpMock,

  rescheduleProspectFollowUp: rescheduleProspectFollowUpMock,

  cancelProspectFollowUp: cancelProspectFollowUpMock,
}));

import { I18nProvider } from '@/lib/i18n/i18n-context';

import FollowUpsPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';

const campaignId = '22222222-2222-4222-8222-222222222222';

const prospectId = '33333333-3333-4333-8333-333333333333';

const establishmentId = '44444444-4444-4444-8444-444444444444';

const followUpId = '55555555-5555-4555-8555-555555555555';

const followUp: FollowUpQueueItem = {
  id: followUpId,

  campaignId,

  prospectId,

  establishmentId,

  dueAt: '2027-09-20T10:00:00.000Z',

  status: 'pending',

  ownership: 'user',

  completedAt: null,

  cancelledAt: null,

  createdAt: '2026-09-17T07:00:00.000Z',

  updatedAt: '2026-09-17T07:00:00.000Z',

  campaignName: 'Paris Expansion',

  establishmentName: 'Paris Clinic',
};

function setProspectorWorkspace(selectedTeamId = teamId): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: `prospector:team:${selectedTeamId}`,

      mode: 'prospector',

      scopeType: 'team',

      teamId: selectedTeamId,
    },
  });
}

describe('FollowUpsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    setProspectorWorkspace();
    listFollowUpQueueMock.mockResolvedValue({ items: [followUp] });
    completeProspectFollowUpMock.mockResolvedValue({ ...followUp, status: 'completed' });
    cancelProspectFollowUpMock.mockResolvedValue({ ...followUp, status: 'cancelled' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not load operational data outside a prospector team workspace', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'admin@intertrad.test', displayName: 'Admin' },
      activeWorkspace: { mode: 'admin', scopeType: 'tenant', teamId: null },
    });

    render(<FollowUpsPage />);

    expect(screen.getByText('This view is scoped to a team.')).toBeInTheDocument();

    await waitFor(() => {
      expect(listFollowUpQueueMock).not.toHaveBeenCalled();
    });
  });

  it('renders in French for a French membership, with no message keys left over', async () => {
    render(
      <I18nProvider locale="fr-FR">
        <FollowUpsPage />
      </I18nProvider>,
    );

    await screen.findByRole('heading', { name: 'Actions' });

    expect(screen.getByText('Gérez vos appels, emails, visites et relances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /À faire/ })).toBeInTheDocument();

    /* A key that reaches the DOM type-checks perfectly and reads as gibberish. */
    expect(document.body.textContent).not.toMatch(/\b(actions|nav|today)\.[a-zA-Z.]+/);
  });

  it('loads the selected team operational queue', async () => {
    render(<FollowUpsPage />);

    expect(await screen.findByText('Paris Clinic')).toBeInTheDocument();

    expect(listFollowUpQueueMock).toHaveBeenCalledWith(expect.objectContaining({ teamId }));
  });

  it('asks the backend for overdue work rather than filtering locally', async () => {
    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('button', { name: /Overdue/ }));

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledWith(
        expect.objectContaining({ teamId, overdue: true }),
      );
    });
  });

  it('completes selected follow-ups and reloads the authoritative queue', async () => {
    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('checkbox', { name: /Select follow-up for Paris Clinic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId, prospectId, followUpId, teamId }),
      );
    });

    /* The list is never patched locally — the server stays authoritative. */
    await waitFor(() => {
      expect(listFollowUpQueueMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('reuses the same idempotency key after an ambiguous failure', async () => {
    completeProspectFollowUpMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ...followUp, status: 'completed' });

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('checkbox', { name: /Select follow-up for Paris Clinic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(1);
    });

    const firstKey = completeProspectFollowUpMock.mock.calls[0]?.[0]?.idempotencyKey;

    expect(firstKey).toBeTruthy();

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('checkbox', { name: /Select follow-up for Paris Clinic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(2);
    });

    /*
     * A failed write may still have been applied server-side, so the retry
     * must be the same logical request rather than a second completion.
     */
    expect(completeProspectFollowUpMock.mock.calls[1]?.[0]?.idempotencyKey).toBe(firstKey);
  });

  it('reports a partial failure instead of claiming every action succeeded', async () => {
    completeProspectFollowUpMock.mockRejectedValue(new Error('nope'));

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('checkbox', { name: /Select follow-up for Paris Clinic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    expect(await screen.findByText(/0 of 1 actions completed/)).toBeInTheDocument();
  });

  it('surfaces a read failure instead of showing an empty queue', async () => {
    listFollowUpQueueMock.mockRejectedValue(
      new ApiError({
        statusCode: 500,
        code: 'UPSTREAM',
        message: 'boom',
        error: 'Server Error',
      }),
    );

    render(<FollowUpsPage />);

    expect(
      await screen.findByText('We could not load your actions. Please try again.'),
    ).toBeInTheDocument();
  });
});
