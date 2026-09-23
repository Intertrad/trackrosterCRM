import { describe, expect, it } from 'vitest';
import { optimizeStops, routeDistance } from './route-geometry.js';
describe('Geographic route estimates', () => {
  const start = { latitude: 0, longitude: 0 };
  it('improves a backtracking itinerary without mutating the source', () => {
    const stops = [
      { id: 'far', point: { latitude: 0, longitude: 3 } },
      { id: 'near', point: { latitude: 0, longitude: 1 } },
      { id: 'middle', point: { latitude: 0, longitude: 2 } },
    ];
    const ordered = optimizeStops(start, stops, null);
    expect(ordered.map((s) => s.id)).toEqual(['near', 'middle', 'far']);
    expect(stops[0]!.id).toBe('far');
    expect(routeDistance(start, ordered, null)).toBeLessThan(routeDistance(start, stops, null));
  });
  it('preserves an already shorter order when the end point changes nearest-neighbor economics', () => {
    const stops = [
      { id: 'a', point: { latitude: 0, longitude: 2 } },
      { id: 'b', point: { latitude: 0, longitude: 1 } },
    ];
    expect(optimizeStops(start, stops, { latitude: 0, longitude: 0 })).toEqual(stops);
    expect(routeDistance(start, [], null)).toBe(0);
  });
});
