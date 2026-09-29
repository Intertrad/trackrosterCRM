import { describe, expect, it } from 'vitest';

import { canRaiseOverride, type CollisionCheckResult } from './collision-types';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

function check(overrides: Partial<CollisionCheckResult> = {}): CollisionCheckResult {
  return {
    decision: 'block',
    reasonCode: 'ACTIVE_RESERVATION',
    collisionId: '8f14e45f-ceea-4e6a-9f3a-1c2d3e4f5a6b',
    overrideable: true,
    expiresAt: '2026-09-24T12:10:00.000Z',
    ...overrides,
  };
}

/*
 * Offering a request the API will refuse is worse than not offering one: the
 * prospector is already blocked, and a button that fails leaves them with no
 * idea whether the route exists at all. All three conditions are required.
 */
describe('canRaiseOverride', () => {
  it('allows a request on a blocked, overrideable, open collision', () => {
    expect(canRaiseOverride(check(), NOW)).toBe(true);
  });

  it('allows one when the engine explicitly requires an override', () => {
    expect(canRaiseOverride(check({ decision: 'require_override' }), NOW)).toBe(true);
  });

  /* An allowed contact records no event, so there is nothing to override. */
  it('refuses when the contact was allowed', () => {
    expect(
      canRaiseOverride(check({ decision: 'allow', collisionId: null, overrideable: false }), NOW),
    ).toBe(false);
  });

  it('refuses when policy forbids an override for this conflict', () => {
    expect(canRaiseOverride(check({ overrideable: false }), NOW)).toBe(false);
  });

  it('refuses when no collision event was recorded', () => {
    expect(canRaiseOverride(check({ collisionId: null }), NOW)).toBe(false);
  });

  /* A collision event is only actionable inside its ten-minute window. */
  it('refuses once the collision window has closed', () => {
    expect(canRaiseOverride(check({ expiresAt: '2026-09-24T11:59:00.000Z' }), NOW)).toBe(false);
  });

  it('allows one when no expiry was published', () => {
    const withoutExpiry = check();

    delete withoutExpiry.expiresAt;

    expect(canRaiseOverride(withoutExpiry, NOW)).toBe(true);
  });

  it('does not treat an unparseable expiry as closed', () => {
    expect(canRaiseOverride(check({ expiresAt: 'soon' }), NOW)).toBe(true);
  });

  it('refuses a warning, which does not block the contact', () => {
    expect(canRaiseOverride(check({ decision: 'warn' }), NOW)).toBe(false);
  });

  it('refuses when there is no check at all', () => {
    expect(canRaiseOverride(null, NOW)).toBe(false);
  });
});
