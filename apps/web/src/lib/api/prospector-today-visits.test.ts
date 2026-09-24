import { describe, expect, it } from 'vitest';

import {
  buildVisits,
  haversineKm,
  totalVisitKm,
  type ProspectorTodayPriority,
} from './prospector-today-types';

function priority(
  id: string,
  latitude: number | null,
  longitude: number | null,
): ProspectorTodayPriority {
  return {
    id,
    campaignId: 'c1',
    campaignProspectId: `cp-${id}`,
    dueAt: '2026-09-21T09:00:00.000Z',
    isOverdue: false,
    category: 'follow_up',
    channel: 'visit',
    establishment: { id: `e-${id}`, name: `Stop ${id}`, city: 'Verdun', latitude, longitude },
  };
}

/* Verdun and Thierville-sur-Meuse are about 2.4 km apart. */
const VERDUN = { latitude: 49.1595, longitude: 5.3833 };
const THIERVILLE = { latitude: 49.1639, longitude: 5.3517 };

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(VERDUN, VERDUN)).toBe(0);
  });

  it('matches a known short distance', () => {
    expect(haversineKm(VERDUN, THIERVILLE)).toBeCloseTo(2.3, 0);
  });

  it('is symmetric', () => {
    expect(haversineKm(VERDUN, THIERVILLE)).toBeCloseTo(haversineKm(THIERVILLE, VERDUN), 6);
  });
});

describe('buildVisits', () => {
  it('keeps the order it was given', () => {
    const visits = buildVisits([
      priority('a', VERDUN.latitude, VERDUN.longitude),
      priority('b', THIERVILLE.latitude, THIERVILLE.longitude),
    ]);

    expect(visits.map((visit) => visit.priority.id)).toEqual(['a', 'b']);
  });

  /*
   * A prospect with no coordinates must be left off the map, not placed at
   * (0,0) — an establishment in the Gulf of Guinea is worse than an absent one.
   */
  it('drops a stop that has never been geocoded', () => {
    const visits = buildVisits([
      priority('a', VERDUN.latitude, VERDUN.longitude),
      priority('b', null, null),
    ]);

    expect(visits.map((visit) => visit.priority.id)).toEqual(['a']);
  });

  it('drops a coordinate outside the valid range', () => {
    expect(buildVisits([priority('a', 91, 0)])).toEqual([]);
    expect(buildVisits([priority('b', 0, 181)])).toEqual([]);
  });

  it('drops a non-finite coordinate rather than producing NaN legs', () => {
    expect(buildVisits([priority('a', Number.NaN, 5)])).toEqual([]);
  });

  it('has no leg distance for the first stop', () => {
    const visits = buildVisits([priority('a', VERDUN.latitude, VERDUN.longitude)]);

    expect(visits[0]?.legKm).toBeNull();
  });

  /* The leg is measured between consecutive *plotted* stops, so a dropped
   * stop in the middle must not break the chain. */
  it('measures the leg across a dropped stop', () => {
    const visits = buildVisits([
      priority('a', VERDUN.latitude, VERDUN.longitude),
      priority('skipped', null, null),
      priority('c', THIERVILLE.latitude, THIERVILLE.longitude),
    ]);

    expect(visits).toHaveLength(2);
    expect(visits[1]?.legKm).toBeCloseTo(haversineKm(VERDUN, THIERVILLE), 6);
  });
});

describe('totalVisitKm', () => {
  it('is zero for a single stop', () => {
    expect(totalVisitKm(buildVisits([priority('a', VERDUN.latitude, VERDUN.longitude)]))).toBe(0);
  });

  it('sums every leg', () => {
    const visits = buildVisits([
      priority('a', VERDUN.latitude, VERDUN.longitude),
      priority('b', THIERVILLE.latitude, THIERVILLE.longitude),
      priority('c', VERDUN.latitude, VERDUN.longitude),
    ]);

    expect(totalVisitKm(visits)).toBeCloseTo(haversineKm(VERDUN, THIERVILLE) * 2, 6);
  });

  it('is zero when nothing could be plotted', () => {
    expect(totalVisitKm(buildVisits([priority('a', null, null)]))).toBe(0);
  });
});
