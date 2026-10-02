/* Basemap configuration. OpenFreeMap supplies the current default style; a
 * deployment can override it with NEXT_PUBLIC_MAP_STYLE_URL when needed. */

const configuredMapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();

export const MAP_STYLE_URL =
  configuredMapStyleUrl || 'https://tiles.openfreemap.org/styles/liberty';

export const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL?.trim() ?? '';

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/** Verdun — the pilot's first region, used before any prospect is plotted. */
export const DEFAULT_CENTER: [number, number] = [5.3828, 49.1596];
export const DEFAULT_ZOOM = 10;

export function isMapConfigured(): boolean {
  return MAP_STYLE_URL.length > 0;
}
