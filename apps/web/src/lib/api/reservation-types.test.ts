import { describe, expect, it } from 'vitest';

import { heartbeatDelayMs, isExpired, minutesRemaining } from './reservation-types';

const NOW = Date.parse('2026-09-23T12:00:00.000Z');

function inSeconds(seconds: number): string {
  return new Date(NOW + seconds * 1000).toISOString();
}

describe('heartbeatDelayMs', () => {
  it('refreshes at a third of the remaining window', () => {
    /* 300s remaining -> 100s, inside the clamp. */
    expect(heartbeatDelayMs(inSeconds(300), NOW)).toBe(100_000);
  });

  it('never waits less than 20s, so a short TTL cannot busy-loop', () => {
    expect(heartbeatDelayMs(inSeconds(30), NOW)).toBe(20_000);
  });

  it('never waits more than 2 minutes, so a long TTL is still refreshed', () => {
    expect(heartbeatDelayMs(inSeconds(3600), NOW)).toBe(120_000);
  });

  /* An already-expired reservation must fire immediately so the UI can
   * discover it is gone rather than sitting on a stale hold. */
  it('fires immediately once the window has passed', () => {
    expect(heartbeatDelayMs(inSeconds(-1), NOW)).toBe(0);
  });

  it('falls back to the maximum rather than NaN on an unparseable expiry', () => {
    expect(heartbeatDelayMs('not-a-date', NOW)).toBe(120_000);
  });
});

describe('isExpired', () => {
  it('treats the exact expiry instant as expired', () => {
    expect(isExpired(inSeconds(0), NOW)).toBe(true);
  });

  it('is false while time remains', () => {
    expect(isExpired(inSeconds(1), NOW)).toBe(false);
  });

  it('does not claim an unparseable expiry has passed', () => {
    expect(isExpired('not-a-date', NOW)).toBe(false);
  });
});

describe('minutesRemaining', () => {
  it('rounds up so a partial minute still reads as remaining', () => {
    expect(minutesRemaining(inSeconds(61), NOW)).toBe(2);
  });

  it('never goes negative', () => {
    expect(minutesRemaining(inSeconds(-600), NOW)).toBe(0);
  });
});
