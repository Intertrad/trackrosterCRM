import { describe, expect, it } from 'vitest';

import { getNavigationForWorkspace, isNavigationItemActive } from './navigation';

describe('workspace navigation', () => {
  it('provides administration navigation for client admin', () => {
    expect(getNavigationForWorkspace('admin').map((item) => item.id)).toEqual([
      'overview',
      'dashboard',
      'imports',
      'administration',
      'overrides',
    ]);
  });

  it('provides scoped management navigation for manager', () => {
    expect(getNavigationForWorkspace('manager').map((item) => item.id)).toEqual([
      'overview',
      'dashboard',
      'overrides',
    ]);
  });

  it('provides operational navigation for prospector', () => {
    expect(getNavigationForWorkspace('prospector').map((item) => item.id)).toEqual([
      'overview',
      'work_queue',
      'follow_ups',
    ]);
  });

  it('keeps observer navigation read-only for now', () => {
    expect(getNavigationForWorkspace('observer').map((item) => item.id)).toEqual(['overview']);
  });

  it('matches nested routes', () => {
    const dashboard = getNavigationForWorkspace('manager').find((item) => item.id === 'dashboard');

    expect(dashboard).toBeDefined();

    expect(isNavigationItemActive('/dashboard/team/123', dashboard!)).toBe(true);
  });
});
