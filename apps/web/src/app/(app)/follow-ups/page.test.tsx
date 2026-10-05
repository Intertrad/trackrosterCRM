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
  requestFollowUpReviewMock,
  cancelProspectFollowUpMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),

  listFollowUpQueueMock: vi.fn(),

  completeProspectFollowUpMock: vi.fn(),

  rescheduleProspectFollowUpMock: vi.fn(),

  requestFollowUpReviewMock: vi.fn(),

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

vi.mock('@/lib/api/follow-up-review-client', () => ({
  requestFollowUpReview: requestFollowUpReviewMock,
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

  category: 'follow_up',

  channel: 'call',

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

  it('loads the workspace-wide queue for an administrator', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'admin@intertrad.test', displayName: 'Admin' },
      activeWorkspace: { mode: 'admin', scopeType: 'tenant', teamId: null },
    });

    render(<FollowUpsPage />);

    expect(
      screen.getByText('Showing follow-ups across the workspace as an administrator.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledWith(expect.objectContaining({ teamId: null }));
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
    /* The three operational groups, in French, replacing the old À faire tab. */
    expect(screen.getByRole('button', { name: /En retard/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aujourd/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /À venir/ })).toBeInTheDocument();

    /* A key that reaches the DOM type-checks perfectly and reads as gibberish. */
    expect(document.body.textContent).not.toMatch(/\b(actions|nav|today)\.[a-zA-Z.]+/);
  });

  it('loads the selected team operational queue', async () => {
    render(<FollowUpsPage />);

    await waitFor(() =>
      expect(listFollowUpQueueMock).toHaveBeenCalledWith(expect.objectContaining({ teamId })),
    );

    /* The fixture is due in 2027, so it is upcoming rather than overdue. */
    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

    expect(await screen.findByText('Paris Clinic')).toBeInTheDocument();
  });

  /*
   * This deliberately reverses an earlier decision, and the reason matters.
   *
   * The page used to ask the API for the overdue set while computing its own counts
   * over the fetched page — two definitions of overdue, and the mismatch shows up as
   * a count that disagrees with the list under it. One fetch classified by the shared
   * helper is the stronger guarantee: every group and every count read the same rows
   * through the same condition.
   *
   * The cost is that grouping describes the fetched set, which the page discloses
   * when it is full. A prospector's own pending follow-ups are bounded in the tens.
   */
  it('groups one fetched set rather than asking the API per tab', async () => {
    render(<FollowUpsPage />);

    await waitFor(() => expect(listFollowUpQueueMock).toHaveBeenCalledTimes(1));

    expect(listFollowUpQueueMock.mock.calls[0]?.[0]).not.toHaveProperty('overdue');

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

    /* Switching group is a re-classification, not another request. */
    expect(listFollowUpQueueMock).toHaveBeenCalledTimes(1);
  });

  it('completes selected follow-ups and reloads the authoritative queue', async () => {
    render(<FollowUpsPage />);

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

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

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

    await screen.findByText('Paris Clinic');

    fireEvent.click(screen.getByRole('checkbox', { name: /Select follow-up for Paris Clinic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(1);
    });

    const firstKey = completeProspectFollowUpMock.mock.calls[0]?.[0]?.idempotencyKey;

    expect(firstKey).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

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

    fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

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

  /*
   * §30/§31. Grouping and counts come from one classified dataset, so a count and
   * the list beneath it cannot be produced by different conditions.
   */
  describe('grouping', () => {
    function at(dueAt: string, over: Partial<FollowUpQueueItem> = {}): FollowUpQueueItem {
      return { ...followUp, id: dueAt, dueAt, ...over };
    }

    const past = '2020-01-01T09:00:00.000Z';
    const future = '2099-01-01T09:00:00.000Z';

    it('files each record in its own group and counts what it renders', async () => {
      listFollowUpQueueMock.mockResolvedValue({
        items: [
          at(past, { establishmentName: 'Late one' }),
          at(past.replace('2020', '2021'), { establishmentName: 'Late two' }),
          at(future, { establishmentName: 'Later' }),
          at(past, {
            id: 'done',
            status: 'completed',
            completedAt: past,
            establishmentName: 'Finished',
          }),
          at(past, {
            id: 'gone',
            status: 'cancelled',
            cancelledAt: past,
            establishmentName: 'Dropped',
          }),
        ],
      });

      render(<FollowUpsPage />);

      /* Two overdue, and the count says two. */
      await waitFor(() => expect(screen.getByText('Late one')).toBeInTheDocument());

      expect(screen.getByText('Late two')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Overdue/ })).toHaveTextContent('2');

      /* Settled records are in no active group and in no active count. */
      expect(screen.queryByText('Finished')).not.toBeInTheDocument();
      expect(screen.queryByText('Dropped')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Upcoming/ }));

      expect(screen.getByText('Later')).toBeInTheDocument();
      expect(screen.queryByText('Late one')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Completed/ }));

      expect(screen.getByText('Finished')).toBeInTheDocument();
    });

    /*
     * §3/§9. An appointment keeps its time group. Moving every meeting to a bucket
     * of its own would hide an overdue one from Overdue.
     */
    it('keeps an overdue appointment in Overdue and marks it', async () => {
      listFollowUpQueueMock.mockResolvedValue({
        items: [at(past, { category: 'meeting', establishmentName: 'Prefecture' })],
      });

      render(<FollowUpsPage />);

      await waitFor(() => expect(screen.getByText('Prefecture')).toBeInTheDocument());

      /* In words, not by colour. */
      expect(screen.getByText('Appointment')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Overdue/ })).toHaveTextContent('1');
    });

    it('shows the recorded channel for the next action', async () => {
      listFollowUpQueueMock.mockResolvedValue({
        items: [at(past, { channel: 'visit', establishmentName: 'Prefecture' })],
      });

      render(<FollowUpsPage />);

      await waitFor(() => expect(screen.getByText('visit')).toBeInTheDocument());
    });

    it('says which group is empty rather than showing one blank table', async () => {
      listFollowUpQueueMock.mockResolvedValue({ items: [at(future)] });

      render(<FollowUpsPage />);

      /* Nothing overdue, and the page says so specifically. */
      await waitFor(() => expect(screen.getByText('No overdue follow-ups.')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Today/ }));

      expect(screen.getByText('Nothing else due today.')).toBeInTheDocument();
    });
  });

  /* §32/§33. Reschedule, and the bucket transition it has to cause. */
  describe('reschedule', () => {
    const past = '2020-01-01T09:00:00.000Z';

    beforeEach(() => {
      rescheduleProspectFollowUpMock.mockResolvedValue(undefined);
      requestFollowUpReviewMock.mockResolvedValue(undefined);
      listFollowUpQueueMock.mockResolvedValue({
        items: [{ ...followUp, dueAt: past, establishmentName: 'Late one' }],
      });
    });

    async function openDialog() {
      render(<FollowUpsPage />);

      await waitFor(() => expect(screen.getByText('Late one')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));

      await waitFor(() => expect(screen.getByLabelText('New date')).toBeInTheDocument());
    }

    it('warns that overdue work needs a manager review and sends the missed reason', async () => {
      await openDialog();

      /* The operator sees what they are changing. */
      expect(screen.getByText(/Currently due/)).toBeInTheDocument();
      expect(screen.getByLabelText<HTMLInputElement>('New date').value).toBe('2020-01-01');
      expect(screen.getByText(/cannot be rescheduled directly/)).toBeInTheDocument();
      expect(screen.getByLabelText('Why was this follow-up missed?')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2099-03-04' } });
      fireEvent.change(screen.getByLabelText('New time'), { target: { value: '14:30' } });
      fireEvent.change(screen.getByLabelText('Why was this follow-up missed?'), {
        target: { value: 'The prospect moved the meeting and the call was missed.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Request manager review' }));

      await waitFor(() => expect(requestFollowUpReviewMock).toHaveBeenCalled());

      const sent = requestFollowUpReviewMock.mock.calls[0]?.[0] as Record<string, string>;

      expect(sent.followUpId).toBe(followUp.id);
      expect(sent.campaignId).toBe(followUp.campaignId);
      expect(sent.prospectId).toBe(followUp.prospectId);
      /* A canonical instant, not a semantic string. */
      expect(sent.dueAt).toMatch(/^2099-03-04T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(sent.reason).toContain('prospect moved');
      expect(sent.idempotencyKey).toBeTruthy();
      expect(rescheduleProspectFollowUpMock).not.toHaveBeenCalled();
    });

    /*
     * §33. The card moves because the server was re-read, not because an array was
     * edited locally.
     */
    it('reloads the queue after requesting a review and keeps the overdue item pending', async () => {
      await openDialog();

      fireEvent.change(screen.getByLabelText('New date'), { target: { value: '2099-03-04' } });
      fireEvent.change(screen.getByLabelText('Why was this follow-up missed?'), {
        target: { value: 'The prospect was unavailable during the agreed calling window.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Request manager review' }));

      await waitFor(() => expect(listFollowUpQueueMock).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(/Review requested/)).toBeInTheDocument();
    });

    it('refuses a second submission while the first is in flight', async () => {
      let release: (() => void) | undefined;

      requestFollowUpReviewMock.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = () => resolve();
          }),
      );

      await openDialog();

      fireEvent.change(screen.getByLabelText('Why was this follow-up missed?'), {
        target: { value: 'The prospect was unexpectedly closed during the planned call.' },
      });

      const confirm = screen.getByRole('button', { name: 'Request manager review' });

      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      await waitFor(() => expect(requestFollowUpReviewMock).toHaveBeenCalledTimes(1));

      release?.();
    });

    it('keeps the dialog usable and the date unchanged when it fails', async () => {
      requestFollowUpReviewMock.mockRejectedValue(new Error('nope'));

      await openDialog();

      fireEvent.change(screen.getByLabelText('Why was this follow-up missed?'), {
        target: { value: 'The prospect asked us to move the conversation to another day.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Request manager review' }));

      await waitFor(() => expect(screen.getByText(/could not be rescheduled/)).toBeInTheDocument());

      /* Still open, still editable, and nothing was moved optimistically. */
      expect(screen.getByLabelText('New date')).toBeInTheDocument();
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(1);
    });

    it('offers no reschedule for a settled follow-up', async () => {
      listFollowUpQueueMock.mockResolvedValue({
        items: [
          {
            ...followUp,
            dueAt: past,
            status: 'completed',
            completedAt: past,
            establishmentName: 'Finished',
          },
        ],
      });

      render(<FollowUpsPage />);

      fireEvent.click(screen.getByRole('button', { name: /Completed/ }));

      await waitFor(() => expect(screen.getByText('Finished')).toBeInTheDocument());

      /* The API offers no reopening, so the action is not offered either. */
      expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    });
  });
});
