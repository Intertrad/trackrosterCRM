import { describe, it, expect } from 'vitest';
import { distanceKm } from './allocation-distance.js';
describe('Allocation great-circle distances', () => {
  it('measures coincident locations and a quarter equatorial circumference', () => {
    expect(distanceKm({ longitude: 2, latitude: 48 }, { longitude: 2, latitude: 48 })).toBe(0);
    expect(distanceKm({ longitude: 0, latitude: 0 }, { longitude: 90, latitude: 0 })).toBeCloseTo(
      10007.5572,
      3,
    );
  });
  it('takes the short path across the date line and remains finite at antipodes', () => {
    expect(
      distanceKm({ longitude: 179, latitude: 0 }, { longitude: -179, latitude: 0 }),
    ).toBeCloseTo(222.39016, 3);
    expect(
      distanceKm({ longitude: 0, latitude: 90 }, { longitude: 180, latitude: -90 }),
    ).toBeCloseTo(20015.11444, 3);
  });
});
