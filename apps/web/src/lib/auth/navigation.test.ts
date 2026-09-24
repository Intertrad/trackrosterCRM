import { describe, expect, it } from 'vitest';

import {
  getNavigationForWorkspace,
  isNavigationItemActive,
  type WorkspaceNavigationItem,
} from './navigation';
import type { WorkspaceMode } from './workspace';

const MODES: WorkspaceMode[] = ['admin', 'director', 'manager', 'prospector', 'observer'];

function labels(items: WorkspaceNavigationItem[]): string[] {
  return items.map((item) => item.label);
}

describe('workspace navigation', () => {
  it('gives the prospector the operational order from the design handoff', () => {
    expect(labels(getNavigationForWorkspace('prospector'))).toEqual([
      'Today',
      'My prospects',
      'Map',
      'Actions',
      'Messages',
    ]);
  });

  it('gives the client admin the administration order from the design handoff', () => {
    const items = getNavigationForWorkspace('admin');

    expect(items.map((item) => item.id).slice(0, 4)).toEqual([
      'administration',
      'users',
      'imports',
      'audit',
    ]);

    /* The four administration screens must be reachable, not just listed. */
    expect(
      items
        .filter((item) => ['administration', 'users', 'imports', 'audit'].includes(item.id))
        .map((item) => item.href),
    ).toEqual(['/admin/overview', '/admin/users', '/admin/imports', '/admin/audit']);
  });

  it('gives the manager the oversight order from the design handoff', () => {
    expect(labels(getNavigationForWorkspace('manager'))).toEqual([
      'Overview',
      'Team',
      'Campaigns',
      'Assignments',
      'Collision center',
      'Approvals',
      'Reports',
      'Exports',
      'Messages',
      'Search',
    ]);
  });

  it('keeps observer navigation read-only', () => {
    const items = getNavigationForWorkspace('observer');

    /* The role has no write path, so nothing here may link to a mutation. */
    expect(labels(items)).toEqual(['Overview', 'Audit']);
  });

  it.each(MODES)('never gives a planned item an href in %s navigation', (mode) => {
    /*
     * A planned item must be unreachable: an href would let the shell, a
     * prefetch or a pasted link navigate to a screen whose API does not exist.
     */
    for (const item of getNavigationForWorkspace(mode)) {
      if (item.availability === 'planned') {
        expect(item.href).toBeUndefined();
      }
    }
  });

  it.each(MODES)('gives every %s item an icon the shell can resolve', (mode) => {
    for (const item of getNavigationForWorkspace(mode)) {
      expect(item.icon).toBeTruthy();
    }
  });

  it.each(MODES)('leaves room for the More tab in the %s mobile bar', (mode) => {
    const primary = getNavigationForWorkspace(mode).filter((item) => item.primary);

    expect(primary.length).toBeLessThanOrEqual(4);
  });

  it.each(MODES)('gives %s at least one reachable screen', (mode) => {
    const ready = getNavigationForWorkspace(mode).filter((item) => item.availability === 'ready');

    expect(ready.length).toBeGreaterThan(0);
  });

  it('matches nested routes for ready navigation items', () => {
    const myProspects = getNavigationForWorkspace('prospector').find(
      (item) => item.id === 'work_queue',
    );

    expect(myProspects).toBeDefined();
    expect(isNavigationItemActive('/work-queue/campaign/prospect', myProspects!)).toBe(true);
  });

  it('does not mark Today active on a nested route', () => {
    const today = getNavigationForWorkspace('prospector').find((item) => item.id === 'overview');

    expect(isNavigationItemActive('/', today!)).toBe(true);
    expect(isNavigationItemActive('/work-queue', today!)).toBe(false);
  });

  it('never marks planned navigation items active', () => {
    /* Overrides is still unbuilt for the admin. A planned item carries no
     * href, so it must never match the path it will one day own. */
    const overrides = getNavigationForWorkspace('admin').find((item) => item.id === 'overrides');

    expect(overrides?.availability).toBe('planned');
    expect(isNavigationItemActive('/admin/overrides', overrides!)).toBe(false);
  });

  it('exposes every manager screen now that each one exists', () => {
    const items = getNavigationForWorkspace('manager');

    expect(items.filter((item) => item.availability === 'planned')).toEqual([]);

    expect(items.map((item) => item.href)).toEqual([
      '/manager/overview',
      '/manager/team',
      '/manager/campaigns',
      '/manager/assignments',
      '/manager/collisions',
      '/manager/approvals',
      '/manager/reports',
      '/manager/exports',
      '/messages',
      '/search',
    ]);
  });

  it('exposes every prospector screen now that each one exists', () => {
    const planned = getNavigationForWorkspace('prospector').filter(
      (item) => item.availability === 'planned',
    );

    expect(planned).toEqual([]);
  });
});
