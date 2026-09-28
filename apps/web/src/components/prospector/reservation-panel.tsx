'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { extendReservation } from '@/lib/api/reservation-client';
import {
  acquireProspectReservation,
  releaseProspectReservation,
} from '@/lib/api/work-queue-client';
import type { ProspectReservationState } from '@/lib/api/work-queue-types';
import { useReservationHeartbeat } from '@/lib/prospector/use-reservation-heartbeat';

export function ReservationPanel({
  campaignId,
  prospectId,
  teamId,
  reservation,
  onChanged,
}: {
  campaignId: string;
  prospectId: string;
  teamId: string;
  reservation: ProspectReservationState | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);

  const owned = reservation?.state === 'owned' ? reservation : null;

  /*
   * A reservation held by this user is kept alive for as long as the prospect
   * is open. Without it the server's expiry scheduler releases the hold
   * mid-visit and the prospector keeps working on a prospect anyone can now
   * claim — the collision guarantee fails silently.
   */
  const heartbeat = useReservationHeartbeat(owned?.reservationId ?? null, owned?.expiresAt ?? null);

  /* The heartbeat's expiry is newer than the one the page last fetched. */
  const expiresAt = owned
    ? (heartbeat.expiresAt ?? owned.expiresAt)
    : reservation && reservation.state !== 'none'
      ? reservation.expiresAt
      : null;

  /* A lock that has silently expired is worse than no lock, so the panel
   * counts down rather than showing a stale "reserved" state. */
  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);

      return;
    }

    function tick(): void {
      const ms = new Date(expiresAt!).getTime() - Date.now();

      if (ms <= 0) {
        setRemaining('expired');
        onChanged();

        return;
      }

      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);

      setRemaining(`${minutes}:${String(seconds).padStart(2, '0')}`);
    }

    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onChanged]);

  async function run(action: 'acquire' | 'release' | 'extend'): Promise<void> {
    setPending(true);
    setError(null);

    try {
      if (action === 'acquire') {
        await acquireProspectReservation({ campaignId, prospectId, teamId });
      } else if (action === 'extend' && reservation?.state === 'owned') {
        await extendReservation(reservation.reservationId, crypto.randomUUID());
      } else if (reservation?.state === 'owned') {
        await releaseProspectReservation({
          campaignId,
          prospectId,
          teamId,
          reservationId: reservation.reservationId,
        });
      }

      onChanged();
    } catch (caught) {
      setError(describeReservationError(caught));

      /*
       * A refused claim means the authority moved while this screen was open, so
       * the screen has to be re-read — not just annotated.
       *
       * Without this the collision banner above goes on saying "Contact allowed"
       * beside a message explaining that somebody else took it, and the page as a
       * whole tells the prospector two different things. The claim is where the
       * server revalidates, so its refusal is the moment the rest of the page is
       * known to be stale.
       */
      if (caught instanceof ApiError && (caught.statusCode === 409 || caught.statusCode === 403)) {
        onChanged();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Reservation" />

      {reservation === null ? (
        <div className="h-20 animate-pulse rounded-lg bg-line-soft" aria-busy="true" />
      ) : (
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted"
          >
            <CalendarClock className="size-5 text-ink-muted" />
          </span>

          <div className="min-w-0 flex-1">
            {reservation.state === 'none' ? (
              <>
                <p className="text-[16px] font-bold text-navy">No active reservation</p>

                <p className="text-[14px] text-ink-muted">
                  Reserve this prospect to block it for your team while you make contact.
                </p>
              </>
            ) : reservation.state === 'owned' ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-bold text-navy">Reserved by you</p>

                  <Badge tone={heartbeat.state === 'lost' ? 'danger' : 'success'} dot>
                    {heartbeat.state === 'lost' ? 'Lost' : 'Active'}
                  </Badge>
                </div>

                <p className="text-[14px] text-ink-muted">
                  {heartbeat.state === 'lost'
                    ? 'This reservation is no longer held.'
                    : `Renews automatically · ${remaining ?? '—'} left`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[16px] font-bold text-navy">Reserved by another user</p>

                <p className="text-[14px] text-ink-muted">
                  Available again at {formatTime(reservation.expiresAt)}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {reservation?.state === 'none' ? (
        <Button fullWidth className="mt-4" loading={pending} onClick={() => void run('acquire')}>
          Reserve
        </Button>
      ) : null}

      {reservation?.state === 'owned' ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            loading={pending}
            disabled={heartbeat.state === 'lost'}
            onClick={() => void run('extend')}
          >
            Extend
          </Button>

          <Button variant="secondary" loading={pending} onClick={() => void run('release')}>
            Release reservation
          </Button>
        </div>
      ) : null}

      {heartbeat.state === 'lost' ? (
        <Alert tone="warning" className="mt-4" title="Your reservation was released.">
          It either expired or was taken over. Refresh before continuing so you do not work a
          prospect someone else now holds.
        </Alert>
      ) : null}
    </Card>
  );
}

function describeReservationError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    /* Two simultaneous claims must not both succeed — this is the engine
     * working, not a failure to report as a generic error. The screen re-reads
     * itself on this, so it no longer asks the prospector to refresh. */
    return 'Another user claimed this prospect first. The status above has been updated.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to reserve this prospect.';
  }

  return 'We could not update the reservation. Please try again.';
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
}
