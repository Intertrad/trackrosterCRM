'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { heartbeatReservation } from '@/lib/api/reservation-client';
import { heartbeatDelayMs, isExpired } from '@/lib/api/reservation-types';

export type HeartbeatState = 'idle' | 'holding' | 'lost';

export interface ReservationHeartbeat {
  /** Live expiry, advanced by each successful heartbeat. */
  expiresAt: string | null;

  state: HeartbeatState;
}

/**
 * Keeps a held reservation alive for as long as the prospect is open.
 *
 * The API stamps every reservation with an `expiresAt` and a background
 * scheduler releases it on time. Without this, a visit that outlasts the TTL
 * loses the reservation silently and the anti-collision guarantee with it —
 * the prospector keeps working on a prospect someone else can now claim.
 *
 * The server owns the TTL and never publishes it, so the cadence is derived
 * from each response's own expiry rather than a constant that could drift out
 * of step with a server-side change.
 */
export function useReservationHeartbeat(
  reservationId: string | null,
  initialExpiresAt: string | null,
): ReservationHeartbeat {
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [state, setState] = useState<HeartbeatState>(reservationId ? 'holding' : 'idle');

  /* Read inside the timer without making it a dependency, so a refreshed
   * expiry reschedules the next tick instead of tearing down the effect. */
  const expiryRef = useRef(initialExpiresAt);

  useEffect(() => {
    expiryRef.current = initialExpiresAt;
    setExpiresAt(initialExpiresAt);
    setState(reservationId ? 'holding' : 'idle');
  }, [initialExpiresAt, reservationId]);

  useEffect(() => {
    if (!reservationId) {
      return;
    }

    const controller = new AbortController();

    let timer: ReturnType<typeof setTimeout> | undefined;

    let stopped = false;

    function schedule(): void {
      const current = expiryRef.current;

      if (stopped || !current) {
        return;
      }

      timer = setTimeout(() => void tick(), heartbeatDelayMs(current));
    }

    async function tick(): Promise<void> {
      if (stopped || !reservationId) {
        return;
      }

      try {
        const refreshed = await heartbeatReservation(reservationId, controller.signal);

        if (stopped) {
          return;
        }

        expiryRef.current = refreshed.expiresAt;
        setExpiresAt(refreshed.expiresAt);

        /*
         * A heartbeat can succeed against a reservation the server has
         * already expired. Trust the returned expiry over the fact that the
         * call returned 200.
         */
        if (refreshed.status !== 'active' || isExpired(refreshed.expiresAt)) {
          setState('lost');

          return;
        }

        setState('holding');
        schedule();
      } catch (error) {
        if (stopped || controller.signal.aborted) {
          return;
        }

        /*
         * 404/409/403 mean the reservation is gone or now belongs to someone
         * else — that is terminal and the operator must be told. A network
         * blip is not: keep trying until the expiry actually passes.
         */
        const terminal =
          error instanceof ApiError && [403, 404, 409, 410].includes(error.statusCode);

        if (terminal || (expiryRef.current && isExpired(expiryRef.current))) {
          setState('lost');

          return;
        }

        schedule();
      }
    }

    schedule();

    return () => {
      stopped = true;
      controller.abort();

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [reservationId]);

  return { expiresAt, state };
}
