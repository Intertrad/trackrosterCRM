'use client';

/* Controls, popups and the attribution bar need MapLibre's own stylesheet.
 * It only ships on routes that render a map, because this component is the
 * single import site. */
import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

import type { LifecycleStageKey } from '@/components/prospector/lifecycle-badge';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_ATTRIBUTION,
  MAP_STYLE_URL,
  isMapConfigured,
} from '@/lib/ui/map-config';
import type { TerritoryFeatureCollection } from '@/lib/api/territory-types';
import { cn } from '@/lib/ui/cn';

const ROUTE_SOURCE_ID = 'trackroster-route';

const ROUTE_LAYER_ID = 'trackroster-route-line';

export interface MapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stage: LifecycleStageKey;
  href?: string;
  cluster?: boolean;
  count?: number;
}

/**
 * Builds a plottable point, or nothing.
 *
 * Coordinates are optional on an establishment and an older API build may not
 * return the fields at all, so a null check alone is not enough: undefined,
 * a non-numeric string or NaN would all reach MapLibre and throw
 * "Invalid LngLat object". Only finite numbers in range are accepted.
 */
export function toMapPoint(
  id: string,
  name: string,
  latitude: unknown,
  longitude: unknown,
  stage: LifecycleStageKey,
  href?: string,
): MapPoint[] {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    latitude === null ||
    longitude === null ||
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return [];
  }

  return [{ id, name, latitude: lat, longitude: lng, stage, href }];
}

/* Token values, resolved once so markers match the rest of the product. */
const STAGE_COLORS: Record<LifecycleStageKey, string> = {
  to_contact: '#0f59fa',
  contact_made: '#5f92f6',
  in_progress: '#5f92f6',
  follow_up: '#d97706',
  qualified: '#7bab1f',
  converted: '#16a34a',
};

export function ProspectMap({
  points,
  territories,
  ordered = false,
  className,
  onSelect,
  onVisibleChange,
  onViewportChange,
  selectedId = null,
  userLocation = null,
}: {
  points: MapPoint[];
  /** Authorised territory boundaries, as returned by GET /territories/map. */
  territories?: TerritoryFeatureCollection | null;
  /*
   * Renders the points as a numbered itinerary joined by a line, in the order
   * given. Used by the day's visits, where sequence is the whole point; the
   * portfolio map leaves it off because its points have no order.
   */
  ordered?: boolean;
  className?: string;
  onSelect?: (point: MapPoint) => void;

  /**
   * Ids currently inside the viewport, emitted on every settled move.
   *
   * The portfolio map counts what a prospector can actually see rather than
   * how many points were handed to it.
   */
  onVisibleChange?: (ids: string[]) => void;

  /** Emits settled WGS84 bounds so the page can request server-side map data. */
  onViewportChange?: (viewport: {
    west: number;
    south: number;
    east: number;
    north: number;
    zoom: number;
  }) => void;

  /** Draws a ring around one point, to show which popup is open. */
  selectedId?: string | null;
  /** Temporary browser location used by the explicit Near me action. */
  userLocation?: { latitude: number; longitude: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);

  /** Detaches the viewport listener when the points or the map change. */
  const cleanupRef = useRef<(() => void) | null>(null);

  const [failed, setFailed] = useState(false);

  /*
   * Set once the map instance exists.
   *
   * Boot is async (two dynamic imports plus construction) while the marker
   * effect only awaits an already-cached import, so the marker effect
   * otherwise wins the race, finds no map, and never runs again — the points
   * prop is stable after the first load. Gating on state gives React a
   * reason to re-run it.
   */
  const [ready, setReady] = useState(false);

  /* MapLibre touches window/WebGL on construction and the bundle is large, so
   * it is imported dynamically on the client only. The style URL supplies the
   * OpenFreeMap Liberty basemap while all TrackRoster overlays remain local.
   */
  useEffect(() => {
    if (!isMapConfigured() || !containerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;
    async function boot(): Promise<void> {
      try {
        const { Map, NavigationControl } = await import('maplibre-gl');

        if (cancelled || !containerRef.current) {
          return;
        }

        const map = new Map({
          container: containerRef.current,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: { customAttribution: MAP_ATTRIBUTION },
          style: MAP_STYLE_URL,
        });

        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

        mapRef.current = map;

        /*
         * Wait for the style, not just the constructor. Adding a source or a
         * layer before the style has loaded throws "Style is not done
         * loading", which aborts the whole marker render — the failure that
         * left the map blank with pins floating on it.
         */
        if (map.isStyleLoaded()) {
          setReady(true);
        } else {
          map.once('load', () => {
            if (!cancelled) {
              setReady(true);
            }
          });
        }

        map.on('error', () => setFailed(true));
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;

      for (const marker of markersRef.current) {
        marker.remove();
      }

      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      markersRef.current = [];

      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  /*
   * Territory boundaries are a separate layer from the markers so they can be
   * refreshed independently, and are drawn under the pins.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !territories) {
      return;
    }

    function draw(): void {
      const current = mapRef.current;

      if (!current || !territories) {
        return;
      }

      const existing = current.getSource('territories');

      if (existing && 'setData' in existing) {
        (existing as { setData: (data: unknown) => void }).setData(territories);

        return;
      }

      current.addSource('territories', { type: 'geojson', data: territories });

      current.addLayer({
        id: 'territory-fill',
        type: 'fill',
        source: 'territories',
        paint: { 'fill-color': '#0f59fa', 'fill-opacity': 0.08 },
      });

      current.addLayer({
        id: 'territory-outline',
        type: 'line',
        source: 'territories',
        paint: { 'line-color': '#0f59fa', 'line-width': 1.6 },
      });
    }

    if (map.isStyleLoaded()) {
      draw();
    } else {
      map.once('load', draw);
    }
  }, [ready, territories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onViewportChange) return;

    const report = () => {
      const bounds = map.getBounds();
      onViewportChange({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom: map.getZoom(),
      });
    };

    map.on('moveend', report);
    if (map.isStyleLoaded()) report();
    else map.once('load', report);

    return () => {
      map.off('moveend', report);
      map.off('load', report);
    };
  }, [onViewportChange, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    let cancelled = false;
    void import('maplibre-gl').then(({ Marker: mapMarker }) => {
      if (cancelled || !mapRef.current) return;

      userMarkerRef.current?.remove();
      const element = document.createElement('div');
      element.setAttribute('aria-label', 'Your location');
      element.style.cssText = [
        'width:18px',
        'height:18px',
        'border-radius:9999px',
        'background:#0f59fa',
        'border:3px solid #ffffff',
        'box-shadow:0 0 0 7px rgba(15,89,250,0.2),0 1px 4px rgba(5,18,74,0.35)',
      ].join(';');
      userMarkerRef.current = new mapMarker({ element })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 13),
        essential: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, userLocation]);

  /* Markers are rebuilt when the filtered set changes, then the view is fitted
   * to what the prospector is actually allowed to see. */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    let cancelled = false;

    async function render(): Promise<void> {
      const { Marker, Popup, LngLatBounds } = await import('maplibre-gl');

      if (cancelled || !mapRef.current) {
        return;
      }

      for (const marker of markersRef.current) {
        marker.remove();
      }

      markersRef.current = [];

      if (points.length === 0) {
        return;
      }

      const bounds = new LngLatBounds();

      const plotted: Array<[number, number]> = [];

      for (const [index, point] of points.entries()) {
        /* Defensive: a caller that bypassed toMapPoint must not crash the map. */
        if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
          continue;
        }

        const element = document.createElement('button');
        element.type = 'button';
        element.setAttribute(
          'aria-label',
          point.cluster
            ? `${point.count ?? 0} prospects`
            : ordered
              ? `Stop ${index + 1}: ${point.name}`
              : point.name,
        );
        element.style.cssText = [
          ordered ? 'width:26px' : 'width:18px',
          ordered ? 'height:26px' : 'height:18px',
          'border-radius:9999px',
          'border:2px solid #ffffff',
          'cursor:pointer',
          'box-shadow:0 1px 4px rgba(5,18,74,0.35)',
          `background:${STAGE_COLORS[point.stage]}`,
          ...(point.id === selectedId
            ? [`box-shadow:0 0 0 4px ${STAGE_COLORS[point.stage]}55,0 1px 4px rgba(5,18,74,0.35)`]
            : []),
          ...(point.cluster
            ? [
                'width:34px',
                'height:34px',
                'color:#ffffff',
                'font-size:12px',
                'font-weight:700',
                'line-height:1',
                'display:flex',
                'align-items:center',
                'justify-content:center',
              ]
            : ordered
              ? [
                  'color:#ffffff',
                  'font-size:12px',
                  'font-weight:700',
                  'line-height:1',
                  'display:flex',
                  'align-items:center',
                  'justify-content:center',
                ]
              : []),
        ].join(';');

        if (ordered) {
          element.textContent = String(index + 1);
        }
        if (point.cluster) element.textContent = String(point.count ?? 0);

        if (!point.cluster) element.addEventListener('click', () => onSelect?.(point));

        const marker = new Marker({ element }).setLngLat([point.longitude, point.latitude]);
        if (!point.cluster) {
          marker.setPopup(new Popup({ offset: 14, closeButton: false }).setText(point.name));
        }
        marker.addTo(mapRef.current!);

        markersRef.current.push(marker);
        plotted.push([point.longitude, point.latitude]);
        bounds.extend([point.longitude, point.latitude]);
      }

      /*
       * The joining line is a straight run between consecutive stops, not a
       * driving route: no routing provider is configured, and drawing a road
       * path we have not computed would misstate the distance.
       */
      if (ordered) {
        const map = mapRef.current;

        const geojson = {
          type: 'FeatureCollection' as const,
          features:
            plotted.length > 1
              ? [
                  {
                    type: 'Feature' as const,
                    properties: {},
                    geometry: { type: 'LineString' as const, coordinates: plotted },
                  },
                ]
              : [],
        };

        const existing = map.getSource(ROUTE_SOURCE_ID);

        if (existing) {
          (existing as unknown as { setData: (data: unknown) => void }).setData(geojson);
        } else {
          map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: geojson });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0F59FA', 'line-width': 3, 'line-opacity': 0.9 },
          });
        }
      }

      if (markersRef.current.length > 0) {
        mapRef.current.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
      }

      if (onVisibleChange) {
        const map = mapRef.current;

        const report = () => {
          const view = map.getBounds();

          onVisibleChange(
            points
              .filter(
                (point) =>
                  Number.isFinite(point.latitude) &&
                  Number.isFinite(point.longitude) &&
                  view.contains([point.longitude, point.latitude]),
              )
              .map((point) => point.id),
          );
        };

        map.on('moveend', report);

        /* fitBounds above runs with duration 0, so the viewport is already
         * final and the first count does not have to wait for a move. */
        report();

        cleanupRef.current = () => map.off('moveend', report);
      }
    }

    void render();

    return () => {
      cancelled = true;

      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [onSelect, onVisibleChange, ordered, points, ready, selectedId]);

  if (!isMapConfigured()) {
    return (
      <MapNotice className={className} title="Basemap is not configured">
        The TrackRoster basemap is not available in this environment. Contact your administrator to
        configure a map style.
      </MapNotice>
    );
  }

  if (failed) {
    return (
      <MapNotice className={className} title="The basemap could not be loaded">
        The basemap is temporarily unavailable. Please try again later.
      </MapNotice>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Prospect map"
      className={cn('min-h-95 w-full overflow-hidden rounded-xl bg-surface-muted', className)}
    />
  );
}

function MapNotice({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-95 flex-col items-center justify-center rounded-xl border border-line-soft bg-surface-muted px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-[17px] font-bold text-navy">{title}</p>

      <p className="mt-2 max-w-md text-[14px] text-ink-soft [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]">
        {children}
      </p>
    </div>
  );
}
