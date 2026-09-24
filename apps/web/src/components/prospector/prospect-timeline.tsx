'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleDot } from 'lucide-react';

import { ActionChannelIcon } from '@/components/prospector/action-channel-icon';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { listProspectTimeline } from '@/lib/api/work-queue-client';
import type { ProspectTimelineActivityItem } from '@/lib/api/work-queue-types';

const PAGE_SIZE = 20;

/*
 * One action = one row. The timeline is append-only by contract, so nothing
 * here offers an edit or delete affordance — a correction is a new entry.
 */
export function ProspectTimeline({
  campaignId,
  prospectId,
  teamId,
  refreshToken,
}: {
  campaignId: string;
  prospectId: string;
  teamId: string;
  refreshToken: number;
}) {
  const [items, setItems] = useState<ProspectTimelineActivityItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const page = await listProspectTimeline({
          campaignId,
          prospectId,
          teamId,
          limit: PAGE_SIZE,
          signal,
        });

        if (signal?.aborted) {
          return;
        }

        setItems(page.items);
        setCursor(page.nextCursor);
        setError(null);
      } catch {
        if (!signal?.aborted) {
          setError('We could not load the history for this prospect.');
        }
      }
    },
    [campaignId, prospectId, teamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, refreshToken]);

  async function loadMore(): Promise<void> {
    if (!cursor) {
      return;
    }

    setLoadingMore(true);

    try {
      const page = await listProspectTimeline({
        campaignId,
        prospectId,
        teamId,
        limit: PAGE_SIZE,
        cursor,
      });

      setItems((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError('We could not load more history.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && !items) {
    return <Alert tone="danger">{error}</Alert>;
  }

  if (!items) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <CircleDot aria-hidden="true" className="mx-auto size-8 text-line" />

        <p className="mt-3 text-[16px] font-semibold text-navy">No activity yet</p>

        <p className="mt-1 text-[14px] text-ink-muted">
          Logged calls, emails, visits and messages appear here permanently.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ol className="flex flex-col">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <ActionChannelIcon channel={item.activityType} className="size-9" />

              {index < items.length - 1 ? (
                <span aria-hidden="true" className="w-px flex-1 bg-line-soft" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-6">
              <p className="text-[15px] font-semibold text-navy">
                {capitalize(item.activityType)} logged
              </p>

              <p className="text-[14px] text-ink-muted">
                <time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time>
              </p>
            </div>
          </li>
        ))}
      </ol>

      {error ? <Alert tone="warning">{error}</Alert> : null}

      {cursor ? (
        <Button variant="secondary" size="md" loading={loadingMore} onClick={() => void loadMore()}>
          Load earlier activity
        </Button>
      ) : null}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
