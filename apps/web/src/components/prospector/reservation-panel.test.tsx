/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ProspectReservationState } from '@/lib/api/work-queue-types';

const { acquireProspectReservationMock, releaseProspectReservationMock, extendReservationMock } =
  vi.hoisted(() => ({
    acquireProspectReservationMock: vi.fn(),
    releaseProspectReservationMock: vi.fn(),
    extendReservationMock: vi.fn(),
  }));

vi.mock('@/lib/api/work-queue-client', () => ({
  acquireProspectReservation: acquireProspectReservationMock,
  releaseProspectReservation: releaseProspectReservationMock,
}));

vi.mock('@/lib/api/reservation-client', () => ({ extendReservation: extendReservationMock }));

import { ReservationPanel } from './reservation-panel';

const campaignId = '11111111-1111-4111-8111-111111111111';
const prospectId = '22222222-2222-4222-8222-222222222222';
const teamId = '33333333-3333-4333-8333-333333333333';

function props(reservation: ProspectReservationState | null, onChanged = vi.fn()) {
  return { campaignId, prospectId, teamId, reservation, onChanged };
}

describe('reservation claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acquireProspectReservationMock.mockResolvedValue(undefined);
    releaseProspectReservationMock.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('claims through the canonical endpoint rather than a local state change', async () => {
    const onChanged = vi.fn();

    render(<ReservationPanel {...props({ state: 'none' }, onChanged)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    await waitFor(() =>
      expect(acquireProspectReservationMock).toHaveBeenCalledWith({
        campaignId,
        prospectId,
        teamId,
      }),
    );

    /* The server is re-read; nothing is assumed about the outcome locally. */
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  /*
   * §7's race. A green screen does not guarantee the hold is still free: the claim
   * is where the server revalidates, and its refusal is the moment everything above
   * is known to be stale.
   */
  it('re-reads the authority when another user claims first', async () => {
    const onChanged = vi.fn();

    acquireProspectReservationMock.mockRejectedValue(
      new ApiError({ statusCode: 409, code: 'CONFLICT', message: 'taken', error: 'Conflict' }),
    );

    render(<ReservationPanel {...props({ state: 'none' }, onChanged)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    await waitFor(() =>
      expect(screen.getByText(/Another user claimed this prospect first/)).toBeInTheDocument(),
    );

    /*
     * Without this the collision banner above would go on saying "Contact allowed"
     * beside a message saying somebody else took it — the page telling the
     * prospector two different things.
     */
    expect(onChanged).toHaveBeenCalled();
    /* And it does not ask the prospector to refresh something it refreshes itself. */
    expect(screen.queryByText(/Refresh to see/)).not.toBeInTheDocument();
  });

  it('re-reads the authority when the claim is refused outright', async () => {
    const onChanged = vi.fn();

    acquireProspectReservationMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<ReservationPanel {...props({ state: 'none' }, onChanged)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    await waitFor(() => expect(screen.getByText(/not authorized to reserve/)).toBeInTheDocument());

    /* An assignment revoked under the prospector is the same situation. */
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not re-read on a transient failure, which leaves the screen valid', async () => {
    const onChanged = vi.fn();

    acquireProspectReservationMock.mockRejectedValue(new Error('network'));

    render(<ReservationPanel {...props({ state: 'none' }, onChanged)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));

    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeInTheDocument());

    /*
     * A dropped request says nothing about who holds the reservation, so the screen
     * is not known to be stale and re-reading would only hide the error.
     */
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('shows a skeleton until the reservation state is known', () => {
    render(<ReservationPanel {...props(null)} />);

    /* Unknown is not free: no claim action is offered yet. */
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Reserve' })).not.toBeInTheDocument();
  });

  it('offers no claim when another user already holds it', () => {
    render(
      <ReservationPanel {...props({ state: 'reserved', expiresAt: '2026-09-28T12:00:00.000Z' })} />,
    );

    expect(screen.getByText('Reserved by another user')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reserve' })).not.toBeInTheDocument();
  });
});
