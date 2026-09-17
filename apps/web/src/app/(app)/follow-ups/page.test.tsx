/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import FollowUpsPage from './page';

const teamId = '11111111-1111-4111-8111-111111111111';

const secondTeamId = '99999999-9999-4999-8999-999999999999';

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

function makeApiError(statusCode: number, messages: string[]): ApiError {
  const error = new Error(messages.join(', ')) as ApiError;

  Object.setPrototypeOf(error, ApiError.prototype);

  Object.assign(error, {
    statusCode,

    messages,
  });

  return error;
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

describe('FollowUpsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    setProspectorWorkspace();

    listFollowUpQueueMock.mockResolvedValue({
      items: [followUp],
    });

    completeProspectFollowUpMock.mockResolvedValue({
      ...followUp,

      status: 'completed',

      completedAt: '2026-09-17T08:00:00.000Z',
    });

    rescheduleProspectFollowUpMock.mockResolvedValue(followUp);

    cancelProspectFollowUpMock.mockResolvedValue({
      ...followUp,

      status: 'cancelled',

      cancelledAt: '2026-09-17T08:00:00.000Z',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not load operational data outside a Prospector team workspace', () => {
    useAuthMock.mockReturnValue({
      activeWorkspace: {
        key: 'manager:team',

        mode: 'manager',

        scopeType: 'team',

        teamId,
      },
    });

    render(<FollowUpsPage />);

    expect(
      screen.getByRole('heading', {
        name: /follow-ups are not available/i,
      }),
    ).toBeInTheDocument();

    expect(listFollowUpQueueMock).not.toHaveBeenCalled();
  });

  it('loads the selected team operational queue', async () => {
    render(<FollowUpsPage />);

    expect(await screen.findByText('Paris Clinic')).toBeInTheDocument();

    expect(listFollowUpQueueMock).toHaveBeenCalledWith({
      teamId,

      overdue: undefined,

      limit: 100,
    });
  });

  it('switches between overdue and upcoming backend filters', async () => {
    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Overdue',
      }),
    );

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledWith({
        teamId,

        overdue: true,

        limit: 100,
      });
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Upcoming',
      }),
    );

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledWith({
        teamId,

        overdue: false,

        limit: 100,
      });
    });
  });

  it('ignores a stale queue response after the workspace changes', async () => {
    const firstRequest = deferred<{
      items: FollowUpQueueItem[];
    }>();

    const secondRequest = deferred<{
      items: FollowUpQueueItem[];
    }>();

    const secondFollowUp: FollowUpQueueItem = {
      ...followUp,

      id: '66666666-6666-4666-8666-666666666666',

      establishmentName: 'Lyon Clinic',
    };

    listFollowUpQueueMock
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    let currentWorkspace = {
      key: `prospector:team:${teamId}`,

      mode: 'prospector',

      scopeType: 'team',

      teamId,
    };

    useAuthMock.mockImplementation(() => ({
      activeWorkspace: currentWorkspace,
    }));

    const { rerender } = render(<FollowUpsPage />);

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(1);
    });

    currentWorkspace = {
      key: `prospector:team:${secondTeamId}`,

      mode: 'prospector',

      scopeType: 'team',

      teamId: secondTeamId,
    };

    rerender(<FollowUpsPage />);

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondRequest.resolve({
        items: [secondFollowUp],
      });
    });

    expect(await screen.findByText('Lyon Clinic')).toBeInTheDocument();

    await act(async () => {
      firstRequest.resolve({
        items: [followUp],
      });
    });

    expect(screen.getByText('Lyon Clinic')).toBeInTheDocument();

    expect(screen.queryByText('Paris Clinic')).not.toBeInTheDocument();
  });

  it('completes a follow-up and reloads the authoritative queue', async () => {
    listFollowUpQueueMock
      .mockResolvedValueOnce({
        items: [followUp],
      })
      .mockResolvedValue({
        items: [],
      });

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete',
      }),
    );

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(1);
    });

    expect(completeProspectFollowUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        idempotencyKey: expect.stringMatching(/^follow-up-complete-/),
      }),
    );

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('Your follow-up queue is clear.')).toBeInTheDocument();
  });

  it('reuses the same complete idempotency key after an ambiguous failure', async () => {
    completeProspectFollowUpMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ...followUp,

        status: 'completed',

        completedAt: '2026-09-17T08:00:00.000Z',
      });

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete',
      }),
    );

    expect(
      await screen.findByText('TrackRoster could not complete this follow-up.'),
    ).toBeInTheDocument();

    const firstKey = completeProspectFollowUpMock.mock.calls[0]?.[0]?.idempotencyKey;

    expect(firstKey).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete',
      }),
    );

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(2);
    });

    const secondKey = completeProspectFollowUpMock.mock.calls[1]?.[0]?.idempotencyKey;

    expect(secondKey).toBe(firstKey);
  });

  it('uses a new complete idempotency key after a definitive 4xx failure', async () => {
    completeProspectFollowUpMock
      .mockRejectedValueOnce(makeApiError(409, ['Follow-up is no longer pending.']))
      .mockResolvedValueOnce({
        ...followUp,

        status: 'completed',

        completedAt: '2026-09-17T08:00:00.000Z',
      });

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete',
      }),
    );

    expect(await screen.findByText('Follow-up is no longer pending.')).toBeInTheDocument();

    const firstKey = completeProspectFollowUpMock.mock.calls[0]?.[0]?.idempotencyKey;

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Complete',
      }),
    );

    await waitFor(() => {
      expect(completeProspectFollowUpMock).toHaveBeenCalledTimes(2);
    });

    const secondKey = completeProspectFollowUpMock.mock.calls[1]?.[0]?.idempotencyKey;

    expect(firstKey).toBeTruthy();

    expect(secondKey).toBeTruthy();

    expect(secondKey).not.toBe(firstKey);
  });

  it('reschedules with an ISO due date and reloads the authoritative queue', async () => {
    const localValue = '2027-10-01T10:30';

    const expectedDueAt = new Date(localValue).toISOString();

    const rescheduled: FollowUpQueueItem = {
      ...followUp,

      dueAt: expectedDueAt,
    };

    listFollowUpQueueMock
      .mockResolvedValueOnce({
        items: [followUp],
      })
      .mockResolvedValue({
        items: [rescheduled],
      });

    rescheduleProspectFollowUpMock.mockResolvedValue(rescheduled);

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reschedule',
      }),
    );

    const input = screen.getByLabelText('New due date and time');

    fireEvent.change(input, {
      target: {
        value: localValue,
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save new time',
      }),
    );

    await waitFor(() => {
      expect(rescheduleProspectFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          dueAt: expectedDueAt,

          idempotencyKey: expect.stringMatching(/^follow-up-reschedule-/),
        }),
      );
    });

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(2);
    });
  });

  it('changing a reschedule time after an ambiguous failure creates a new logical mutation key', async () => {
    rescheduleProspectFollowUpMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(followUp);

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reschedule',
      }),
    );

    const input = screen.getByLabelText('New due date and time');

    fireEvent.change(input, {
      target: {
        value: '2027-10-01T10:30',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save new time',
      }),
    );

    expect(
      await screen.findByText('TrackRoster could not reschedule this follow-up.'),
    ).toBeInTheDocument();

    const firstKey = rescheduleProspectFollowUpMock.mock.calls[0]?.[0]?.idempotencyKey;

    fireEvent.change(input, {
      target: {
        value: '2027-10-02T11:45',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save new time',
      }),
    );

    await waitFor(() => {
      expect(rescheduleProspectFollowUpMock).toHaveBeenCalledTimes(2);
    });

    const secondKey = rescheduleProspectFollowUpMock.mock.calls[1]?.[0]?.idempotencyKey;

    expect(firstKey).toBeTruthy();

    expect(secondKey).toBeTruthy();

    expect(secondKey).not.toBe(firstKey);
  });

  it('requires confirmation before cancelling and then reloads the queue', async () => {
    listFollowUpQueueMock
      .mockResolvedValueOnce({
        items: [followUp],
      })
      .mockResolvedValue({
        items: [],
      });

    render(<FollowUpsPage />);

    await screen.findByText('Paris Clinic');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel',
      }),
    );

    expect(cancelProspectFollowUpMock).not.toHaveBeenCalled();

    expect(screen.getByText('Cancel this follow-up?')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm cancellation',
      }),
    );

    await waitFor(() => {
      expect(cancelProspectFollowUpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          idempotencyKey: expect.stringMatching(/^follow-up-cancel-/),
        }),
      );
    });

    await waitFor(() => {
      expect(listFollowUpQueueMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('Your follow-up queue is clear.')).toBeInTheDocument();
  });
});
