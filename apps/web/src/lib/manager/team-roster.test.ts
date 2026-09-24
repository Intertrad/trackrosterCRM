import { describe, expect, it } from 'vitest';

import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import type { MembershipSummary } from '@/lib/api/membership-types';

import { buildTeamRoster, rosterStatus } from './team-roster';

const membership = (overrides: Partial<MembershipSummary> = {}): MembershipSummary => ({
  id: 'm1',
  identityId: 'i1',
  email: 'nabil.benchariki@intertrad.test',
  displayName: 'Nabil Benchariki',
  status: 'active',
  roles: ['prospector'],
  capacity: 200,
  ...overrides,
});

const dashboard = (rows: ManagerDashboardResponse['byProspector']) =>
  ({ byProspector: rows }) as ManagerDashboardResponse;

describe('buildTeamRoster', () => {
  it('joins reporting metrics onto the real person', () => {
    const [row] = buildTeamRoster(
      [membership()],
      dashboard([
        {
          userId: 'm1',
          activities: 48,
          currentAssignments: 142,
          pendingFollowUps: 20,
          overdueFollowUps: 2,
        },
      ]),
    );

    expect(row).toMatchObject({
      name: 'Nabil Benchariki',
      initials: 'NB',
      activeProspects: 142,
      actionsThisPeriod: 48,
      overdue: 2,
      capacityPercent: 71,
    });
  });

  it('keeps a member with no reported activity instead of dropping them', () => {
    const [row] = buildTeamRoster([membership()], dashboard([]));

    expect(row).toMatchObject({ name: 'Nabil Benchariki', activeProspects: 0, overdue: 0 });
  });

  it('reports capacity as unavailable when no target is set', () => {
    const [row] = buildTeamRoster([membership({ capacity: null })], dashboard([]));

    /* Zero would read as an empty workload; unavailable is the truth. */
    expect(row!.capacityPercent).toBeNull();
  });

  it('falls back to the email when a display name is missing', () => {
    const [row] = buildTeamRoster([membership({ displayName: null })], dashboard([]));

    expect(row!.name).toBe('nabil.benchariki@intertrad.test');
  });

  it('excludes departed members from the roster', () => {
    expect(buildTeamRoster([membership({ status: 'departed' })], dashboard([]))).toEqual([]);
  });

  it('tolerates a failed dashboard read', () => {
    const [row] = buildTeamRoster([membership()], null);

    expect(row).toMatchObject({ name: 'Nabil Benchariki', activeProspects: 0 });
  });
});

describe('rosterStatus', () => {
  const base = buildTeamRoster([membership()], dashboard([]))[0]!;

  it('flags a member at or above the design threshold', () => {
    expect(rosterStatus({ ...base, capacityPercent: 85, actionsThisPeriod: 10 })).toBe('at_risk');
  });

  it('leaves a loaded but under-threshold member on track', () => {
    expect(rosterStatus({ ...base, capacityPercent: 78, actionsThisPeriod: 10 })).toBe('on_track');
  });

  it('marks a member with no activity inactive', () => {
    expect(rosterStatus({ ...base, capacityPercent: 40, actionsThisPeriod: 0 })).toBe('inactive');
  });
});
