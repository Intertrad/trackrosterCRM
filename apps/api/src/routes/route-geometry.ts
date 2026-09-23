import { distanceKm } from '../assignments/allocation-distance.js';
import type { RoutePoint } from '../database/schema/field-routes.js';
export function routeDistance(
  start: RoutePoint,
  stops: { point: RoutePoint }[],
  end: RoutePoint | null,
) {
  let total = 0,
    previous = start;
  for (const stop of stops) {
    total += distanceKm(previous, stop.point);
    previous = stop.point;
  }
  if (end) total += distanceKm(previous, end);
  return Math.round(total * 1000) / 1000;
}
export function optimizeStops<T extends { id: string; point: RoutePoint }>(
  start: RoutePoint,
  stops: T[],
  end: RoutePoint | null,
): T[] {
  const left = [...stops],
    ordered: T[] = [];
  let previous = start;
  while (left.length) {
    left.sort(
      (a, b) =>
        distanceKm(previous, a.point) - distanceKm(previous, b.point) || a.id.localeCompare(b.id),
    );
    const next = left.shift()!;
    ordered.push(next);
    previous = next.point;
  }
  // Never replace the user's order with a longer geographic itinerary.
  return routeDistance(start, ordered, end) < routeDistance(start, stops, end)
    ? ordered
    : [...stops];
}
