'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import { LocateFixed, TriangleAlert } from 'lucide-react';

import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { MapLegend } from '@/components/prospector/map-surface';
import { LIFECYCLE_ORDER, getLifecycleLabelKey } from '@/components/prospector/lifecycle-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { listMapProspects } from '@/lib/api/map-client';
import type { MapViewport } from '@/lib/api/map-types';
import { listNearbyProspects } from '@/lib/api/nearby-client';
import {
  DEFAULT_NEARBY_RADIUS_METERS,
  formatDistanceMeters,
  type NearbyProspect,
} from '@/lib/api/nearby-types';
import { SearchInput } from '@/components/ui/search-input';
import { getTerritoryMap } from '@/lib/api/territory-client';
import type { TerritoryFeatureCollection } from '@/lib/api/territory-types';
import type { WorkQueueLifecycleStage } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';

export default function TerritoryMapPage() {
  const { activeWorkspace } = useAuth();
  const { t } = useTranslation();

  const teamId = activeWorkspace?.teamId ?? null;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [mapSummary, setMapSummary] = useState<{ prospects: number; truncated: boolean } | null>(
    null,
  );
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [territories, setTerritories] = useState<TerritoryFeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * "Near me" is a separate query from the portfolio: it asks the API what is
   * within a radius of the device, which can include prospects the current
   * filters exclude.
   */
  const [nearby, setNearby] = useState<NearbyProspect[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const scoped = Boolean(teamId);

  const [refreshVersion, setRefreshVersion] = useState(0);
  useLiveRefresh(() => setRefreshVersion((version) => version + 1));

  useEffect(() => {
    if (!viewport) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      listMapProspects(
        {
          ...viewport,
          ...(teamId ? { teamId } : {}),
          ...(status !== 'all' ? { lifecycleStage: status as WorkQueueLifecycleStage } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        },
        controller.signal,
      )
        .then((response) => {
          if (controller.signal.aborted) return;
          const next = response.features.flatMap((feature) => {
            const [longitude, latitude] = feature.geometry.coordinates;
            const props = feature.properties;
            const stage = props.stages?.[0] ?? 'to_contact';
            return toMapPoint(
              props.establishmentId ?? feature.id,
              props.name ?? 'Prospect cluster',
              latitude,
              longitude,
              stage,
              props.cluster ? undefined : `/admin/prospects/${props.establishmentId ?? feature.id}`,
            ).map((point) => ({
              ...point,
              cluster: props.cluster,
              count: props.count,
            }));
          });
          setPoints(next);
          setMapSummary({ prospects: response.summary.prospects, truncated: response.truncated });
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : 'We could not load prospects for the map.',
            );
          }
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, teamId, viewport, refreshVersion]);

  /* Boundaries are scoped server-side, so no team filter is applied here. */
  useEffect(() => {
    const controller = new AbortController();

    getTerritoryMap(controller.signal)
      .then((collection) => {
        if (!controller.signal.aborted) {
          setTerritories(collection);
        }
      })
      .catch(() => {
        /* Boundaries are contextual; their absence must not blank the map. */
        if (!controller.signal.aborted) {
          setTerritories(null);
        }
      });

    return () => controller.abort();
  }, [refreshVersion]);

  const handleSelect = useCallback((point: MapPoint) => setSelected(point), []);

  /*
   * Geolocation is requested only when asked for. The coordinates go straight
   * to the API for the radius query and are not stored.
   */
  async function findNearby(): Promise<void> {
    if (!('geolocation' in navigator)) {
      setNearbyError('This browser cannot provide your location.');

      return;
    }

    setLocating(true);
    setNearbyError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 });
      });

      const page = await listNearbyProspects({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusMeters: DEFAULT_NEARBY_RADIUS_METERS,
        limit: 25,
      });

      setNearby(page.items);
    } catch (caught) {
      setNearby(null);
      setNearbyError(
        caught instanceof GeolocationPositionError || !(caught instanceof ApiError)
          ? 'We could not read your location. Check the browser permission.'
          : 'We could not search near you. Please try again.',
      );
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Map" subtitle="Explore prospects across your authorised territory" />

      <div className="flex flex-wrap gap-3">
        <SearchInput
          label="Search establishments"
          placeholder="Search establishments..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1"
        />

        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            ...LIFECYCLE_ORDER.map((value) => ({ value, label: t(getLifecycleLabelKey(value)) })),
          ]}
        />

        <Button
          variant="secondary"
          className="self-end"
          loading={locating}
          onClick={() => void findNearby()}
        >
          <LocateFixed aria-hidden="true" className="mr-2 size-4" />
          Near me
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-3">
          <ProspectMap
            points={points}
            territories={territories}
            onSelect={handleSelect}
            onViewportChange={setViewport}
          />

          <MapLegend includeUnavailable={false} />
        </div>

        <div className="flex flex-col gap-5">
          {nearbyError ? <Alert tone="warning">{nearbyError}</Alert> : null}

          {nearby !== null ? (
            <Card>
              <CardHeader
                title="Near you"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setNearby(null);
                      setNearbyError(null);
                    }}
                    className="text-[14px] font-semibold text-brand hover:text-brand-hover"
                  >
                    Clear
                  </button>
                }
              />

              {nearby.length === 0 ? (
                <p className="py-6 text-center text-[15px] text-ink-muted">
                  Nothing within {formatDistanceMeters(DEFAULT_NEARBY_RADIUS_METERS)} of you.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft">
                  {nearby.map((prospect) => (
                    <li key={prospect.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-navy">
                        {prospect.name}
                      </span>

                      <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">
                        {formatDistanceMeters(prospect.distance)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title={selected ? selected.name : 'Map details'} />

            {selected ? (
              <LinkButton href={selected.href ?? '/work-queue'} variant="primary">
                Open prospect
              </LinkButton>
            ) : (
              <p className="text-[15px] text-ink-soft">
                {scoped
                  ? 'Select a marker to open its record.'
                  : 'Switch to a team workspace to see a scoped portfolio.'}
              </p>
            )}

            <p className="mt-4 text-[14px] text-ink-muted">
              {mapSummary?.prospects ?? 0} prospect{(mapSummary?.prospects ?? 0) === 1 ? '' : 's'}{' '}
              plotted
              {mapSummary?.truncated ? ' (zoom in to load more)' : ''}
            </p>

            {error ? (
              <Alert tone="danger" className="mt-4">
                {error}
              </Alert>
            ) : null}

            <p className="mt-4 text-[14px] text-ink-muted">
              {territories === null
                ? 'Territory boundaries are unavailable.'
                : `${territories.features.length} authorised territor${
                    territories.features.length === 1 ? 'y' : 'ies'
                  } outlined.`}
            </p>
          </Card>

          <Card>
            <CardHeader title="Collision watch" />

            <p className="flex items-center gap-2 text-[14px] text-ink-soft">
              <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
              Recent reservations in your area
            </p>

            {/* The collision-event register exists; wiring it is the next step. */}
            <Alert tone="info" className="mt-4">
              Recent collisions in your area are not listed yet.
            </Alert>
          </Card>
        </div>
      </div>

      <p className="text-[13px] text-ink-muted">
        You can view and interact with prospects within your authorised territory only. Other
        prospects are shown as unavailable.
      </p>
    </div>
  );
}
