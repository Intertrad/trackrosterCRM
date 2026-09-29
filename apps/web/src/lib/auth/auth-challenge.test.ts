/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  challengeRoute,
  clearChallenges,
  readMfaChallenge,
  readWorkspaceChallenge,
  storeChallenge,
} from './auth-challenge';

describe('auth challenge store', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('round-trips an MFA challenge', () => {
    storeChallenge({ next: 'mfa', challengeToken: 'token', expiresIn: 300 });

    expect(readMfaChallenge()?.challengeToken).toBe('token');
  });

  it('drops a challenge once its server-side window has passed', () => {
    vi.useFakeTimers();

    storeChallenge({ next: 'mfa', challengeToken: 'token', expiresIn: 300 });

    vi.advanceTimersByTime(301_000);

    expect(readMfaChallenge()).toBeNull();
    expect(window.sessionStorage.getItem('trackroster.auth.mfa_challenge')).toBeNull();
  });

  it('keeps workspace memberships alongside the selection token', () => {
    const memberships = [
      {
        membershipId: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        tenantName: 'InterTrad France',
        displayName: 'Grand Est',
      },
    ];

    storeChallenge({
      next: 'workspace',
      selectionToken: 'selection',
      expiresIn: 300,
      memberships,
    });

    expect(readWorkspaceChallenge()).toMatchObject({
      selectionToken: 'selection',
      memberships,
    });
  });

  it('stores nothing for an already-authenticated outcome', () => {
    storeChallenge({ next: 'authenticated' });

    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears every challenge kind at once', () => {
    storeChallenge({ next: 'mfa', challengeToken: 'token', expiresIn: 300 });
    storeChallenge({
      next: 'workspace',
      selectionToken: 'selection',
      expiresIn: 300,
      memberships: [],
    });

    clearChallenges();

    expect(readMfaChallenge()).toBeNull();
    expect(readWorkspaceChallenge()).toBeNull();
  });

  it('routes each outcome to the screen that can complete it', () => {
    expect(challengeRoute({ next: 'authenticated' })).toBe('/');
    expect(challengeRoute({ next: 'mfa', challengeToken: 't', expiresIn: 1 })).toBe('/mfa');
    expect(
      challengeRoute({
        next: 'workspace',
        selectionToken: 's',
        expiresIn: 1,
        memberships: [],
      }),
    ).toBe('/select-workspace');
  });
});
