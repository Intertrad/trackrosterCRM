export type Coordinates = { longitude: number; latitude: number };
/** Great-circle kilometres, not driving time or a live GPS distance. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const latitude = rad(b.latitude - a.latitude),
    longitude = rad(b.longitude - a.longitude);
  const h =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(longitude / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
