import { describe, expect, it } from 'vitest';

import type { SelfAccessGrant } from '@/lib/api/auth-types';

import { deriveAvailableWorkspaces } from './workspace';

describe('deriveAvailableWorkspaces', () => {
  it('keeps the director workspace ahead of a prospector workspace', () => {
    const grants: SelfAccessGrant[] = [
      {
        role: 'prospector',
        scopeType: 'team',
        organizationId: 'org-1',
        teamId: 'team-1',
      },
      {
        role: 'director',
        scopeType: 'organization',
        organizationId: 'org-1',
        teamId: null,
      },
    ];

    expect(deriveAvailableWorkspaces(grants).map((workspace) => workspace.mode)).toEqual([
      'director',
      'prospector',
    ]);
  });
});
