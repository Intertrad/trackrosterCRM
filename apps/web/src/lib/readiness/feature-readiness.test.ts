import { describe, expect, it } from 'vitest';

import { NAVIGATION_FEATURE, getNavigationForWorkspace } from '@/lib/auth/navigation';
import type { WorkspaceMode } from '@/lib/auth/workspace';

import { isAvailable, isUncertifiedWrite, readinessOf } from './feature-readiness';

const MODES: WorkspaceMode[] = ['admin', 'director', 'manager', 'prospector', 'observer'];

describe('feature readiness', () => {
  it('claims nothing is production-ready, because the audit does not', () => {
    /*
     * The audit's own words: "no high-risk multi-tenant write family should be
     * labeled fully production-ready because the complete restricted-role
     * matrix is not green". If this ever fails, the audit was re-run and this
     * registry was not updated with it.
     */
    expect(readinessOf('reservations')).not.toBe('PRODUCTION_READY');
    expect(isUncertifiedWrite('assignments')).toBe(true);
  });

  it('treats the audit’s "do not integrate" list as unavailable', () => {
    for (const feature of [
      'scheduled_reports',
      'compliance_artifacts',
      'provider_sync',
      'outbound_webhooks',
    ] as const) {
      expect(readinessOf(feature)).toBe('BLOCKED');
      expect(isAvailable(feature)).toBe(false);
    }
  });

  it('offers no screen whose audited family is unavailable', () => {
    /* The point of the registry: a blocked capability cannot be offered, no
     * matter how finished the screen behind it looks. */
    for (const mode of MODES) {
      for (const item of getNavigationForWorkspace(mode)) {
        const feature = NAVIGATION_FEATURE[item.id];

        if (feature) {
          expect({ mode, id: item.id, available: isAvailable(feature) }).toEqual({
            mode,
            id: item.id,
            available: true,
          });
        }
      }
    }
  });
});
