import { describe, expect, it } from 'vitest';

import { organizationSlugFromName } from './workspace-administration.service.js';

describe('organizationSlugFromName', () => {
  it('normalizes names into URL-safe slugs', () => {
    expect(organizationSlugFromName('  Équipe Grand Est  ')).toBe('equipe-grand-est');
  });

  it('keeps a safe fallback when a name has no ASCII slug characters', () => {
    expect(organizationSlugFromName('—')).toBe('organization');
  });
});
