'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_ATTRIBUTION, MAP_STYLE_URL } from '@/lib/ui/map-config';

type Position = [number, number];
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] };

function polygonFromValue(value: unknown): PolygonGeometry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (!['Polygon', 'MultiPolygon'].includes(String(candidate.type))) return null;
  if (!Array.isArray(candidate.coordinates)) return null;
  const ring =
    candidate.type === 'MultiPolygon' ? candidate.coordinates[0]?.[0] : candidate.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const positions = ring.filter(
    (position): position is Position =>
      Array.isArray(position) &&
      position.length >= 2 &&
      Number.isFinite(Number(position[0])) &&
      Number.isFinite(Number(position[1])),
  );
  return positions.length >= 4
    ? { type: 'Polygon', coordinates: [positions.map(([lng, lat]) => [Number(lng), Number(lat)])] }
    : null;
}

function closeRing(points: Position[]): Position[] {
  if (points.length === 0) return [];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return last[0] === first[0] && last[1] === first[1] ? points : [...points, first];
}

function normalizedRing(points: Position[]): Position[] | null {
  const unique = points.filter(
    (point, index) =>
      points.findIndex(([lng, lat]) => lng === point[0] && lat === point[1]) === index,
  );
  if (unique.length < 3) return null;
  const ring = closeRing(unique);
  const twiceArea = ring.reduce((area, [lng, lat], index) => {
    const [nextLng, nextLat] = ring[(index + 1) % ring.length]!;
    return area + lng * nextLat - nextLng * lat;
  }, 0);
  return Math.abs(twiceArea) > Number.EPSILON ? ring : null;
}

function sourceData(points: Position[], boundary: PolygonGeometry | null) {
  const features: Array<Record<string, unknown>> = [];
  if (boundary) {
    features.push({ type: 'Feature', properties: { kind: 'boundary' }, geometry: boundary });
  } else if (points.length >= 3) {
    features.push({
      type: 'Feature',
      properties: { kind: 'boundary' },
      geometry: { type: 'Polygon', coordinates: [closeRing(points)] },
    });
  } else if (points.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { kind: 'line' },
      geometry: { type: 'LineString', coordinates: points },
    });
  }
  for (const [index, point] of points.entries()) {
    features.push({
      type: 'Feature',
      properties: { kind: 'point', index: index + 1 },
      geometry: { type: 'Point', coordinates: point },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function TerritoryBoundaryField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const { language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Position[]>(() => {
    const boundary = polygonFromValue(value);
    return boundary?.coordinates[0]?.slice(0, -1) ?? [];
  });
  const [drawError, setDrawError] = useState<string | null>(null);
  const boundary = useMemo(() => polygonFromValue(value), [value]);
  const [committedBoundary, setCommittedBoundary] = useState<PolygonGeometry | null>(
    () => boundary,
  );
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (drawing) return;
    if (value === previousValueRef.current) return;
    previousValueRef.current = value;
    setCommittedBoundary(boundary);
    setPoints(boundary?.coordinates[0]?.slice(0, -1) ?? []);
  }, [boundary, drawing, value]);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    async function boot() {
      try {
        const { Map, NavigationControl } = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;
        const map = new Map({
          container: containerRef.current,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          style: MAP_STYLE_URL,
          attributionControl: { customAttribution: MAP_ATTRIBUTION },
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.doubleClickZoom.disable();
        map.on('click', (event) => {
          if (!drawingRef.current) return;
          setDrawError(null);
          setPoints((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
        });
        map.on('error', () => setFailed(true));
        mapRef.current = map;
        if (map.isStyleLoaded()) setReady(true);
        else map.once('load', () => !cancelled && setReady(true));
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = sourceData(points, drawing ? null : committedBoundary);
    const existing = map.getSource('territory-boundary-draft');
    if (existing && 'setData' in existing) {
      (existing as { setData: (value: unknown) => void }).setData(data);
      return;
    }
    map.addSource('territory-boundary-draft', { type: 'geojson', data });
    map.addLayer({
      id: 'territory-boundary-fill',
      type: 'fill',
      source: 'territory-boundary-draft',
      filter: ['==', ['get', 'kind'], 'boundary'],
      paint: { 'fill-color': '#0f59fa', 'fill-opacity': 0.18 },
    });
    map.addLayer({
      id: 'territory-boundary-line',
      type: 'line',
      source: 'territory-boundary-draft',
      filter: ['in', ['get', 'kind'], ['literal', ['boundary', 'line']]],
      paint: { 'line-color': '#0f59fa', 'line-width': 3, 'line-dasharray': [1, 1] },
    });
    map.addLayer({
      id: 'territory-boundary-points',
      type: 'circle',
      source: 'territory-boundary-draft',
      filter: ['==', ['get', 'kind'], 'point'],
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': 5,
        'circle-stroke-color': '#0f59fa',
        'circle-stroke-width': 2,
      },
    });
  }, [committedBoundary, drawing, points, ready]);

  const startDrawing = () => {
    setDrawing(true);
    setDrawError(null);
    setPoints([]);
  };

  const finishDrawing = () => {
    if (points.length < 3) {
      setDrawError(
        language === 'fr'
          ? 'Ajoutez au moins trois points pour créer une limite.'
          : 'Add at least three points to create a boundary.',
      );
      return;
    }
    const ring = normalizedRing(points);
    if (!ring) {
      setDrawError(
        language === 'fr'
          ? 'Les points doivent former une zone distincte.'
          : 'The points must form a distinct area.',
      );
      return;
    }
    const nextBoundary = { type: 'Polygon' as const, coordinates: [ring] };
    setCommittedBoundary(nextBoundary);
    onChange(nextBoundary);
    setDrawing(false);
    setDrawError(null);
  };

  const clearBoundary = () => {
    setPoints([]);
    setDrawing(false);
    setDrawError(null);
    setCommittedBoundary(null);
    onChange(null);
  };

  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 font-semibold">{label}</legend>
      <p className="text-xs text-ink-muted">
        {drawing
          ? language === 'fr'
            ? 'Cliquez sur la carte pour ajouter des points, puis terminez la limite.'
            : 'Click the map to add points, then finish the boundary.'
          : language === 'fr'
            ? 'Dessinez une zone pour définir sa couverture géographique.'
            : 'Draw an area to define its geographic coverage.'}
      </p>
      <div
        ref={containerRef}
        className={`h-64 overflow-hidden rounded-lg border border-line-soft bg-line-soft sm:h-72 ${drawing ? 'cursor-crosshair' : ''}`}
        aria-label={
          language === 'fr' ? 'Carte de dessin de la limite' : 'Territory boundary drawing map'
        }
      />
      {failed && (
        <Alert tone="danger">
          {language === 'fr'
            ? 'La carte est indisponible. Vous pouvez réessayer plus tard.'
            : 'The map is unavailable. Please try again later.'}
        </Alert>
      )}
      {error || drawError ? <p className="text-sm text-danger">{error || drawError}</p> : null}
      <div className="flex flex-wrap gap-2">
        {drawing ? (
          <>
            <Button type="button" onClick={finishDrawing} disabled={points.length < 3}>
              {language === 'fr' ? 'Terminer la limite' : 'Finish boundary'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDrawing(false)}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={startDrawing}>
            {committedBoundary
              ? language === 'fr'
                ? 'Remplacer la limite'
                : 'Replace boundary'
              : language === 'fr'
                ? 'Dessiner une limite'
                : 'Draw boundary'}
          </Button>
        )}
        {(committedBoundary || points.length > 0) && !drawing ? (
          <Button type="button" variant="ghost" onClick={clearBoundary}>
            {language === 'fr' ? 'Effacer la limite' : 'Clear boundary'}
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}
