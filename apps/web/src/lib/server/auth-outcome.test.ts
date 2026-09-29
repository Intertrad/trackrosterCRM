import { beforeEach, describe, expect, it, vi } from 'vitest';

const setAuthCookies = vi.fn();

vi.mock('./auth-cookies', () => ({
  setAuthCookies: (...args: unknown[]) => setAuthCookies(...args),
}));

const { resolveAuthenticationOutcome } = await import('./auth-outcome');

describe('resolveAuthenticationOutcome', () => {
  beforeEach(() => {
    setAuthCookies.mockClear();
  });

  it('installs session cookies only for a real token pair', async () => {
    const outcome = await resolveAuthenticationOutcome({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    expect(outcome).toEqual({ next: 'authenticated' });
    expect(setAuthCookies).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('never writes cookies for an MFA challenge', async () => {
    const outcome = await resolveAuthenticationOutcome({
      mfaRequired: true,
      challengeToken: 'challenge',
      expiresIn: 300,
    });

    expect(outcome).toEqual({
      next: 'mfa',
      challengeToken: 'challenge',
      expiresIn: 300,
    });

    expect(setAuthCookies).not.toHaveBeenCalled();
  });

  it('never writes cookies for a required enrollment', async () => {
    const outcome = await resolveAuthenticationOutcome({
      mfaEnrollmentRequired: true,
      challengeToken: 'challenge',
      setupKey: 'KEY',
      otpauthUri: 'otpauth://totp/TrackRoster',
      expiresIn: 600,
    });

    expect(outcome).toMatchObject({ next: 'mfa_enrollment', setupKey: 'KEY' });
    expect(setAuthCookies).not.toHaveBeenCalled();
  });

  it('never writes cookies for a workspace selection', async () => {
    const memberships = [
      {
        membershipId: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        tenantName: 'InterTrad France',
        displayName: null,
      },
    ];

    const outcome = await resolveAuthenticationOutcome({
      workspaceRequired: true,
      selectionToken: 'selection',
      expiresIn: 300,
      memberships,
    });

    expect(outcome).toEqual({
      next: 'workspace',
      selectionToken: 'selection',
      expiresIn: 300,
      memberships,
    });

    expect(setAuthCookies).not.toHaveBeenCalled();
  });

  it('refuses an unrecognized result rather than creating a half session', async () => {
    await expect(resolveAuthenticationOutcome({} as never)).rejects.toThrow(
      'Unrecognized authentication result',
    );

    expect(setAuthCookies).not.toHaveBeenCalled();
  });
});
