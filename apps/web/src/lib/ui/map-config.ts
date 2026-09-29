/*
 * Basemap configuration.
 *
 * Tiles are served as a single Protomaps .pmtiles archive from infrastructure
 * you control, so prospect coordinates are never sent to a third-party tile
 * host on every pan and zoom. Nothing renders until the archive is published
 * and this variable points at it.
 */
export const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL?.trim() ?? '';

export const MAP_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Verdun — the pilot's first region, used before any prospect is plotted. */
export const DEFAULT_CENTER: [number, number] = [5.3828, 49.1596];
export const DEFAULT_ZOOM = 10;

export function isMapConfigured(): boolean {
  return PMTILES_URL.length > 0;
}
