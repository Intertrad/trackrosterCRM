'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Navigation, ShieldAlert, ShieldCheck } from 'lucide-react';

import {
  LIFECYCLE_ORDER,
  LIFECYCLE_STYLES,
  LifecycleBadge,
  getLifecycleLabelKey,
} from '@/components/prospector/lifecycle-badge';
import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { Card } from '@/components/ui/card';
import { useTranslation, type Translate } from '@/lib/i18n/i18n-context';
import { LinkButton } from '@/components/ui/link-button';
import { listNearbyProspects } from '@/lib/api/nearby-client';
import { formatDistanceMeters, type NearbyProspect } from '@/lib/api/nearby-types';
import type { WorkQueueItem, WorkQueueLifecycleStage } from '@/lib/api/work-queue-types';
import { cn } from '@/lib/ui/cn';

const NEARBY_RADIUS_METERS = 10_000;

/**
 * The portfolio on a map, with the nearby panel beside it.
 *
 * Points come from the same records the list shows, so the two views can
 * never disagree. "Near <place>" is a separate spatial read against
 * `GET /prospects/nearby`, anchored on whichever prospect is selected.
 */
export function PortfolioMap({
  items,
  blockedProspectIds,
}: {
  items: WorkQueueItem[];
  blockedProspectIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);

  const points = useMemo(
    () =>
      items.flatMap((item) =>
        toMapPoint(
          item.campaignProspectId,
          item.establishment.name,
          item.establishment.latitude,
          item.establishment.longitude,
          item.lifecycleStage,
          `/work-queue/${item.campaign.id}/${item.campaignProspectId}`,
        ),
      ),
    [items],
  );

  const byId = useMemo(
    () => new Map(items.map((item) => [item.campaignProspectId, item])),
    [items],
  );

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const onSelect = useCallback((point: MapPoint) => setSelectedId(point.id), []);

  const onVisibleChange = useCallback((ids: string[]) => setVisibleIds(ids), []);

  const visibleCount = visibleIds === null ? points.length : visibleIds.length;

  /* An establishment is only plottable once it has been geocoded; the rest
   * would otherwise vanish from the map with no explanation. */
  const withoutCoordinates = items.length - points.length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)] xl:items-start">
      <Card className="relative overflow-hidden p-0 sm:p-0">
        <div className="relative">
          <ProspectMap
            points={points}
            selectedId={selectedId}
            onSelect={onSelect}
            onVisibleChange={onVisibleChange}
            className="h-[380px] sm:h-[460px] xl:h-[520px]"
          />

          <span
            className={cn(
              'pointer-events-none absolute top-4 left-4 rounded-full bg-surface px-3.5 py-1.5',
              'text-[13px] font-bold text-navy shadow-card',
            )}
          >
            {t('portfolio.visible', { visible: visibleCount, total: points.length })}
          </span>
        </div>

        {selected ? (
          <SelectedProspect
            item={selected}
            blocked={blockedProspectIds.has(selected.campaignProspectId)}
            onDismiss={() => setSelectedId(null)}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft px-5 py-3.5">
          {LIFECYCLE_ORDER.map((stage) => (
            <span key={stage} className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-full', LIFECYCLE_STYLES[stage].dot)}
              />
              {t(getLifecycleLabelKey(stage))}
            </span>
          ))}

          {withoutCoordinates > 0 ? (
            <span className="text-[13px] text-ink-muted">
              {t('portfolio.withoutCoordinates', { count: withoutCoordinates })}
            </span>
          ) : null}
        </div>
      </Card>

      <NearbyPanel anchor={selected} />
    </div>
  );
}

/**
 * The prospect whose marker is open.
 *
 * Rendered under the map rather than as a floating callout so it never covers
 * the points around it, and so it reads the same on a phone.
 */
function SelectedProspect({
  item,
  blocked,
  onDismiss,
}: {
  item: WorkQueueItem;
  blocked: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold text-navy">
          {item.establishment.name}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <LifecycleBadge stage={item.lifecycleStage} />

          {blocked ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-danger">
              <ShieldAlert aria-hidden="true" className="size-4" />
              {t('portfolio.blockedByClaim')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t('portfolio.noCollision')}
            </span>
          )}
        </span>
      </span>

      {/* Reserving a prospect runs a collision check, an override path and a
          heartbeat; it lives on the prospect itself rather than being
          reimplemented in a map callout. */}
      <LinkButton
        variant="primary"
        href={`/work-queue/${item.campaign.id}/${item.campaignProspectId}`}
      >
        {t('portfolio.openProspect')}
      </LinkButton>

      <button
        type="button"
        onClick={onDismiss}
        className="text-[14px] font-semibold text-ink-muted hover:text-ink"
      >
        {t('common.close')}
      </button>
    </div>
  );
}

/**
 * Other prospects around the selected one.
 *
 * `GET /prospects/nearby` is scoped to the caller's own assignments upstream,
 * so this can only ever list work the prospector already holds.
 */
function NearbyPanel({ anchor }: { anchor: WorkQueueItem | null }) {
  const { t } = useTranslation();

  const [nearby, setNearby] = useState<NearbyProspect[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latitude = anchor?.establishment.latitude ?? null;
  const longitude = anchor?.establishment.longitude ?? null;

  useEffect(() => {
    if (latitude === null || longitude === null) {
      setNearby(null);
      setError(null);

      return;
    }

    const controller = new AbortController();

    listNearbyProspects(
      { latitude, longitude, radiusMeters: NEARBY_RADIUS_METERS, limit: 20 },
      controller.signal,
    )
      .then((page) => {
        if (!controller.signal.aborted) {
          setNearby(page.items);
          setError(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNearby([]);
          setError(t('portfolio.nearbyError'));
        }
      });

    return () => controller.abort();
  }, [latitude, longitude]);

  if (!anchor) {
    return (
      <Card>
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
          {t('portfolio.nearby')}
        </h2>

        <p className="mt-2 text-[15px] text-ink-muted">{t('portfolio.nearbyPrompt')}</p>
      </Card>
    );
  }

  const place = anchor.establishment.city ?? anchor.establishment.name;

  const others = (nearby ?? []).filter((entry) => entry.id !== anchor.establishment.id);

  return (
    <Card className="flex flex-col">
      <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
        {t('portfolio.near', { place })}
      </h2>

      <p className="mt-1 text-[14px] text-ink-muted">
        {nearby === null
          ? t('portfolio.nearbyLoading')
          : t('portfolio.nearbyCount', {
              count: others.length,
              radius: formatDistanceMeters(NEARBY_RADIUS_METERS),
            })}
      </p>

      {error ? <p className="mt-4 text-[14px] text-ink-muted">{error}</p> : null}

      {nearby === null ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : others.length === 0 && !error ? (
        <p className="mt-4 text-[14px] text-ink-muted">
          {t('portfolio.nearbyEmpty', { radius: formatDistanceMeters(NEARBY_RADIUS_METERS) })}
        </p>
      ) : (
        <ul aria-label={t('portfolio.near', { place })} className="mt-4 flex flex-col gap-1.5">
          {others.map((entry) => (
            <li key={entry.id}>
              <span className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 shrink-0 rounded-full', dotFor(entry.stages))}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-navy">
                    {entry.name}
                  </span>

                  <span className="block truncate text-[13px] text-ink-muted">
                    {stageLabel(entry.stages, t)}
                  </span>
                </span>

                <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">
                  {formatDistanceMeters(entry.distance)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <LinkButton variant="primary" href="/routes/new" className="mt-4 w-full">
        <Navigation aria-hidden="true" className="mr-2 size-[18px]" />
        {t('portfolio.planRound')}
      </LinkButton>

      <p className="mt-3 flex items-start gap-2 text-[12px] text-ink-muted">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t('portfolio.scopeNote')}
      </p>
    </Card>
  );
}

/* A nearby record can hold several stages across campaigns; the furthest
 * along is the one worth showing. */
function primaryStage(stages: string[] | undefined): WorkQueueLifecycleStage | null {
  for (const stage of [...LIFECYCLE_ORDER].reverse()) {
    if (stages?.includes(stage)) {
      return stage;
    }
  }

  return null;
}

function dotFor(stages: string[] | undefined): string {
  const stage = primaryStage(stages);

  return stage ? LIFECYCLE_STYLES[stage].dot : 'bg-line';
}

function stageLabel(stages: string[] | undefined, t: Translate): string {
  const stage = primaryStage(stages);

  return stage ? t(getLifecycleLabelKey(stage)) : t('stage.assigned');
}
