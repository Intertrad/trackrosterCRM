'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldAlert } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import { listOverrideRequests } from '@/lib/api/override-client';
import type { OverrideRequestStatus, OverrideRequestSummary } from '@/lib/api/override-types';
import { cn } from '@/lib/ui/cn';
import { shortenId } from '@/lib/ui/person';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
} as const;

export default function ApprovalsQueuePage() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const tabs: Array<{ id: OverrideRequestStatus; label: string }> = [
    { id: 'pending', label: l('Pending', 'En attente') },
    { id: 'approved', label: l('Approved', 'Approuvées') },
    { id: 'rejected', label: l('Rejected', 'Rejetées') },
    { id: 'cancelled', label: l('Cancelled', 'Annulées') },
  ];
  const [status, setStatus] = useState<OverrideRequestStatus>('pending');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<OverrideRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const page = await listOverrideRequests({ status, limit: 50 }, signal);

        if (signal?.aborted) {
          return;
        }

        setItems(page.items);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 403
            ? l(
                'You do not have override authority for this scope.',
                'Vous n’avez pas le droit de déroger sur ce périmètre.',
              )
            : l(
                'We could not load override requests. Please try again.',
                'Impossible de charger les demandes de dérogation. Réessayez.',
              ),
        );
      }
    },
    [language, status],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    setItems(null);
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items ?? [];
    }

    return (items ?? []).filter((item) => item.reason.toLowerCase().includes(query));
  }, [items, search]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l('Approvals', 'Validations')}
        subtitle={l(
          'Review override requests before two teams cross paths',
          'Examinez les demandes de dérogation avant que deux équipes ne se croisent',
        )}
      />

      {error ? (
        <Alert tone="danger">
          {error}

          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <SearchInput
        label={l('Search requests', 'Rechercher des demandes')}
        placeholder={l('Search by reason...', 'Rechercher par motif…')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-md"
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            aria-pressed={status === tab.id}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors',
              status === tab.id
                ? 'bg-brand-tint text-brand'
                : 'bg-surface-muted text-ink-soft hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <QueueSkeleton />
      ) : visible.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <ShieldAlert aria-hidden="true" className="mx-auto size-9 text-line" />

            <p className="mt-3 text-[17px] font-bold text-navy">
              {search
                ? l(
                    'No requests match your search',
                    'Aucune demande ne correspond à votre recherche',
                  )
                : l(
                    `No ${status} requests`,
                    `Aucune demande ${tabs.find((tab) => tab.id === status)?.label.toLowerCase() ?? 'en cours'}`,
                  )}
            </p>

            <p className="mt-1 text-[14px] text-ink-muted">
              {status === 'pending'
                ? l(
                    'Requests appear here when a prospector contests a collision.',
                    'Les demandes apparaissent lorsqu’un prospecteur conteste un conflit.',
                  )
                : l(
                    'Decided requests are kept as audit evidence.',
                    'Les demandes traitées sont conservées comme preuve d’audit.',
                  )}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-line-soft">
            {visible.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/manager/approvals/${request.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-muted sm:px-6"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-bg"
                  >
                    <ShieldAlert className="size-[18px] text-warning" />
                  </span>

                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {request.reason}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {l('Requested by', 'Demandée par')} {shortenId(request.requestedBy)} ·{' '}
                      {formatDateTime(request.createdAt)}
                    </span>
                  </span>

                  <span className="shrink-0 font-mono text-[13px] text-ink-muted">
                    {shortenId(request.id)}
                  </span>

                  <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>

                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function QueueSkeleton() {
  const { language } = useTranslation();

  return (
    <Card className="p-0 sm:p-0" aria-busy="true">
      <span className="sr-only">
        {text('Loading override requests…', 'Chargement des demandes de dérogation…', language)}
      </span>

      <ul className="divide-y divide-line-soft">
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex animate-pulse items-center gap-4 px-6 py-5">
            <span className="size-10 rounded-full bg-line-soft" />
            <span className="h-5 flex-1 rounded bg-line-soft" />
            <span className="h-6 w-20 rounded-md bg-line-soft" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
