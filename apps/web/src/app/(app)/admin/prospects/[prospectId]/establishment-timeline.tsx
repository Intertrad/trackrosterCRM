'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, MessageSquare, MapPin, Phone } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { listMemberships } from '@/lib/api/membership-client';
import { getCampaignProspectTimeline } from '@/lib/api/prospect-client';
import type { ProspectCampaignMembership } from '@/lib/api/prospect-types';
import type {
  ProspectTimelineActivityItem,
  ProspectTimelineActivityType,
} from '@/lib/api/work-queue-types';

/*
 * The establishment's history, assembled from the campaigns that hold it.
 *
 * There is no establishment-level activity endpoint and deliberately so: activity
 * belongs to a campaign prospect, and TR-930's membership read is what supplies the
 * identifiers needed to reach the existing scoped timeline. This merges those
 * results; it does not define a second activity domain.
 *
 * Authorization is unchanged. Only memberships the API already returned are
 * fetched, and each fetch is authorized again on its own — a membership hidden
 * from the context section cannot be reached by editing an id.
 */

/* One bounded page per membership. Deep history is the campaign's own screen. */
const PER_MEMBERSHIP_LIMIT = 20;

/* Enough to name the actors on a page of history; truncation is disclosed. */
const MEMBERSHIP_PAGE_SIZE = 100;

const CHANNEL_ICON: Record<ProspectTimelineActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  message: MessageSquare,
  visit: MapPin,
};

interface TimelineEntry {
  item: ProspectTimelineActivityItem;
  organizationId: string;
  organizationName: string;
  campaignName: string;
}

interface Loaded {
  entries: TimelineEntry[];
  /** Organizations whose timeline could not be read, named so it is not silent. */
  failedOrganizations: string[];
  /** True when every request failed, which is a different thing from no history. */
  allFailed: boolean;
  truncated: boolean;
  actorNames: Map<string, string>;
}

export function EstablishmentTimeline({
  memberships,
}: {
  memberships: ProspectCampaignMembership[];
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (memberships.length === 0) {
        setLoaded(null);

        return;
      }

      setLoaded(null);

      /*
       * One request per visible membership, all in parallel. An establishment sits
       * in a handful of campaigns, not hundreds, so the fan-out is bounded by the
       * membership count and each page is capped — no request grows with the size
       * of the history.
       */
      const [pages, roster] = await Promise.all([
        Promise.allSettled(
          memberships.map((membership) =>
            getCampaignProspectTimeline(
              membership.campaign.id,
              membership.campaignProspectId,
              { limit: PER_MEMBERSHIP_LIMIT },
              signal,
            ),
          ),
        ),
        /* Names for the actor ids the timeline returns; it carries only the id. */
        listMemberships({ limit: MEMBERSHIP_PAGE_SIZE }, signal).catch(() => null),
      ]);

      if (signal?.aborted) {
        return;
      }

      const entries: TimelineEntry[] = [];
      const failedOrganizations: string[] = [];
      let truncated = false;

      pages.forEach((page, index) => {
        const membership = memberships[index]!;

        if (page.status === 'rejected') {
          failedOrganizations.push(membership.organization.name);

          return;
        }

        truncated = truncated || page.value.nextCursor !== null;

        for (const item of page.value.items) {
          entries.push({
            item,
            organizationId: membership.organization.id,
            organizationName: membership.organization.name,
            campaignName: membership.campaign.name,
          });
        }
      });

      /* Merged on the activity's own timestamp, which is the canonical ordering. */
      entries.sort(
        (left, right) =>
          new Date(right.item.occurredAt).getTime() - new Date(left.item.occurredAt).getTime(),
      );

      setLoaded({
        entries,
        failedOrganizations,
        allFailed: failedOrganizations.length === memberships.length,
        truncated,
        actorNames: new Map(
          (roster?.items ?? []).map((person) => [person.id, person.displayName ?? person.email]),
        ),
      });
    },
    [memberships],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, attempt]);

  /* Built from what came back, never from a fixed list of entity names. */
  const organizations = useMemo(() => {
    const seen = new Map<string, string>();

    for (const membership of memberships) {
      seen.set(membership.organization.id, membership.organization.name);
    }

    return [...seen].map(([id, name]) => ({ id, name }));
  }, [memberships]);

  const visible = useMemo(
    () =>
      organizationFilter
        ? (loaded?.entries ?? []).filter((entry) => entry.organizationId === organizationFilter)
        : (loaded?.entries ?? []),
    [loaded, organizationFilter],
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">Activity history</h2>

        {loaded ? <Badge tone="neutral">{visible.length}</Badge> : null}

        {organizations.length > 1 ? (
          <FilterSelect
            label="Entity"
            className="ml-auto"
            value={organizationFilter}
            onChange={setOrganizationFilter}
            options={[
              { value: '', label: 'All entities' },
              ...organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            ]}
          />
        ) : null}
      </div>

      {/* No membership at all is a different statement from no activity. */}
      {memberships.length === 0 ? (
        <p className="text-[14px] text-ink-muted">
          No campaign holds this establishment, so there is no activity to show.
        </p>
      ) : loaded === null ? (
        <div className="flex animate-pulse flex-col gap-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading the activity history</span>

          <div className="h-14 rounded-lg bg-surface-muted" />
          <div className="h-14 rounded-lg bg-surface-muted" />
        </div>
      ) : (
        <>
          {/*
           * A partial failure names the entities whose history is missing. Leaving
           * it out would present an incomplete history as a complete one.
           */}
          {loaded.failedOrganizations.length > 0 ? (
            <div className="mb-4 flex flex-col items-start gap-3">
              <Alert tone={loaded.allFailed ? 'warning' : 'info'}>
                {loaded.allFailed
                  ? 'The activity history could not be loaded.'
                  : `History is missing for ${loaded.failedOrganizations.join(', ')}.`}
              </Alert>

              <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
                Retry
              </Button>
            </div>
          ) : null}

          {visible.length === 0 && !loaded.allFailed ? (
            <p className="text-[14px] text-ink-muted">
              {organizationFilter
                ? 'No activity recorded for this entity.'
                : 'This establishment is enrolled but nothing has been recorded against it yet.'}
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {visible.map((entry) => (
                <TimelineRow
                  key={entry.item.id}
                  entry={entry}
                  actorName={loaded.actorNames.get(entry.item.actor.userId) ?? null}
                />
              ))}
            </ol>
          )}

          {/* Said rather than implied: this is the recent history, not all of it. */}
          {loaded.truncated ? (
            <p className="mt-4 text-[13px] text-ink-muted">
              Showing the {PER_MEMBERSHIP_LIMIT} most recent events per campaign. Older events are
              on the campaign&rsquo;s own screens.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function TimelineRow({ entry, actorName }: { entry: TimelineEntry; actorName: string | null }) {
  const Icon = CHANNEL_ICON[entry.item.activityType];

  return (
    <li className="flex gap-3 rounded-lg border border-line-soft p-3">
      <span className="mt-0.5 shrink-0 text-ink-muted">
        <Icon aria-hidden="true" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {/* Channel and when, in words — the type is not conveyed by the icon alone. */}
          <span className="text-[15px] font-semibold text-navy capitalize">
            {entry.item.activityType}
          </span>

          <span className="text-[14px] text-ink-muted">{formatMoment(entry.item.occurredAt)}</span>
        </div>

        {/*
         * Where it happened. The same establishment worked by two entities produces
         * two histories, and an event without its origin is unreadable.
         */}
        <span className="block truncate text-[13px] text-ink-muted">
          {[entry.organizationName, entry.campaignName, actorName].filter(Boolean).join(' · ')}
        </span>
      </div>
    </li>
  );
}

function formatMoment(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
