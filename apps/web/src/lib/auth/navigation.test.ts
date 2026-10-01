import { describe, expect, it } from 'vitest';

import {
  getNavigationForWorkspace,
  getPlatformNavigation,
  getRoleHome,
  isRouteAllowedForWorkspace,
  isNavigationItemActive,
  type WorkspaceNavigationItem,
} from './navigation';
import type { WorkspaceMode } from './workspace';

const MODES: WorkspaceMode[] = ['admin', 'director', 'manager', 'prospector', 'observer'];

function labelKeys(items: WorkspaceNavigationItem[]): string[] {
  return items.map((item) => item.label);
}

describe('workspace navigation', () => {
  describe('workspace route guard', () => {
    it('keeps each tenant role inside its authorized route families', () => {
      expect(isRouteAllowedForWorkspace('/manager/overview', 'manager')).toBe(true);
      expect(isRouteAllowedForWorkspace('/director/overview', 'manager')).toBe(false);
      expect(isRouteAllowedForWorkspace('/admin/overview', 'manager')).toBe(false);
      expect(isRouteAllowedForWorkspace('/manager/overview', 'prospector')).toBe(false);
      expect(isRouteAllowedForWorkspace('/observer/overview', 'observer')).toBe(true);
      expect(isRouteAllowedForWorkspace('/manager/overview', 'observer')).toBe(false);
    });

    it('allows the expected oversight hierarchy without widening platform routes', () => {
      expect(isRouteAllowedForWorkspace('/manager/assignments', 'director')).toBe(true);
      expect(isRouteAllowedForWorkspace('/director/reports', 'director')).toBe(true);
      expect(isRouteAllowedForWorkspace('/admin/users', 'director')).toBe(false);
      expect(isRouteAllowedForWorkspace('/admin/users', 'admin')).toBe(true);
      expect(isRouteAllowedForWorkspace('/platform/overview', 'admin')).toBe(false);
      expect(isRouteAllowedForWorkspace('/platform/overview', 'admin', true)).toBe(true);
    });

    it('leaves shared routes reachable from every workspace', () => {
      for (const mode of MODES) {
        expect(isRouteAllowedForWorkspace('/messages', mode)).toBe(true);
      }
    });
  });

  it('keeps a platform-only identity out of tenant navigation', () => {
    expect(getRoleHome(undefined, true)).toBe('/platform/overview');
    expect(getRoleHome('observer', true)).toBe('/observer/overview');
    expect(getPlatformNavigation().every((item) => item.href?.startsWith('/platform/'))).toBe(true);
  });
  it('gives the prospector the operational order from the design handoff', () => {
    expect(labelKeys(getNavigationForWorkspace('prospector'))).toEqual([
      'nav.today',
      'nav.prospects',
      'nav.map',
      'nav.followUps',
      'nav.actionsHistory',
      'nav.performance',
      'nav.messages',
    ]);
  });

  /*
   * The référentiel took the place imports held, which is a deliberate change of
   * the earlier handoff rather than a drift. The V2 walkthrough lists Prospects as
   * its third administration screen and Import as its twenty-first, and the base is
   * what an administrator opens daily while an import is occasional. The bar still
   * holds four, so something had to move rather than be added.
   */
  it('gives the client admin the administration order from the design handoff', () => {
    const items = getNavigationForWorkspace('admin');

    expect(items.map((item) => item.id).slice(0, 4)).toEqual([
      'administration',
      'live',
      'referential',
      'users',
    ]);

    /* Every administration screen must be reachable, not just listed. */
    expect(
      items
        .filter((item) =>
          ['administration', 'users', 'referential', 'audit', 'imports'].includes(item.id),
        )
        .map((item) => item.href),
    ).toEqual([
      '/admin/overview',
      '/admin/prospects',
      '/admin/users',
      '/admin/imports',
      '/admin/audit',
    ]);
  });

  it('gives the manager the oversight order from the design handoff', () => {
    expect(labelKeys(getNavigationForWorkspace('manager'))).toEqual([
      'nav.overview',
      'nav.objectives',
      'nav.prospects',
      'nav.team',
      'nav.campaigns',
      'nav.assignments',
      'nav.territories',
      'nav.approvals',
      'nav.reports',
      'nav.messages',
      'nav.collisions',
      'nav.exports',
      'nav.search',
      'nav.workspaceTools',
    ]);
  });

  it('keeps observer navigation read-only', () => {
    const items = getNavigationForWorkspace('observer');

    /* The role has no write path, so nothing here may link to a mutation. */
    expect(labelKeys(items)).toEqual([
      'nav.overview',
      'nav.audit',
      'nav.security',
      'nav.assignments',
      'nav.exports',
      'nav.workspaceTools',
    ]);
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

  it('connects administrator override navigation to the existing approval workflow', () => {
    const overrides = getNavigationForWorkspace('admin').find((item) => item.id === 'overrides');
    expect(overrides?.availability).toBe('ready');
    expect(isNavigationItemActive('/manager/approvals', overrides!)).toBe(true);
  });

  it('exposes every manager screen now that each one exists', () => {
    const items = getNavigationForWorkspace('manager');

    expect(items.filter((item) => item.availability === 'planned')).toEqual([]);

    expect(items.map((item) => item.href)).toEqual([
      '/manager/overview',
      '/manager/objectives',
      '/work-queue',
      '/manager/team',
      '/manager/campaigns',
      '/manager/assignments',
      '/manager/territories',
      '/manager/approvals',
      '/manager/reports',
      '/messages',
      '/manager/collisions',
      '/manager/exports',
      '/search',
      '/workspace',
    ]);
  });

  it('gives the director the executive reporting workspace', () => {
    const items = getNavigationForWorkspace('director');

    expect(items.map((item) => item.href)).toEqual([
      '/director/overview',
      '/director/reports',
      '/director/campaigns',
      '/director/territories',
      '/director/performance',
      '/director/exports',
      '/workspace',
    ]);
  });

  it('exposes every prospector screen now that each one exists', () => {
    expect(getNavigationForWorkspace('prospector').map((item) => item.href)).toEqual([
      '/',
      '/work-queue',
      '/map',
      '/follow-ups',
      '/actions',
      '/performance',
      '/messages',
    ]);

    const planned = getNavigationForWorkspace('prospector').filter(
      (item) => item.availability === 'planned',
    );

    expect(planned).toEqual([]);
  });
});
