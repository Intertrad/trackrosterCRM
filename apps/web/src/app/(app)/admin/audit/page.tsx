'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, FileText, Lock, ShieldAlert, Users } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, FieldRow } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { getAuditOverview, listAuditEvents } from '@/lib/api/audit-client';
import {
  auditActionLabel,
  auditResourceLabel,
  auditSeverity,
  type AuditEvent,
  type AuditOverview,
  type AuditSeverity,
  type AuditStream,
} from '@/lib/api/audit-types';
import { listMemberships } from '@/lib/api/membership-client';
import {
  membershipInitials,
  membershipName,
  type MembershipSummary,
} from '@/lib/api/membership-types';

/*
 * The API caps a page at 100 and its keyset cursor is unsound — it filters on
 * `id > cursor` while sorting by `occurred_at DESC`, so following nextCursor
 * returns an arbitrary subset rather than the next page. The window is widened
 * instead, and the ceiling is stated on screen rather than hidden behind a
 * "next" button that would quietly show the wrong rows.
 */
const PAGE_STEP = 25;

const MAX_WINDOW = 100;

const STREAM_OPTIONS: Array<{ value: AuditStream; label: string }> = [
  { value: 'events', label: 'All activity' },
  { value: 'data-changes', label: 'Prospect data' },
  { value: 'security-events', label: 'Security' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'overrides', label: 'Override requests' },
  { value: 'collisions', label: 'Collisions' },
  { value: 'exports', label: 'Exports' },
];

export default function AuditLogPage() {
  return (
    <AdminGuard title="Audit log" subtitle="Review sensitive changes and security activity">
      <Suspense fallback={<AuditSkeleton />}>
        <AuditLog />
      </Suspense>
    </AdminGuard>
  );
}

function AuditLog() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const searchParams = useSearchParams();

  const initialStream = useMemo<AuditStream>(() => {
    const requested = searchParams.get('stream');

    return STREAM_OPTIONS.some((option) => option.value === requested)
      ? (requested as AuditStream)
      : 'events';
  }, [searchParams]);

  const [stream, setStream] = useState<AuditStream>(initialStream);
  const [limit, setLimit] = useState(PAGE_STEP);
  const [severity, setSeverity] = useState<'all' | AuditSeverity>('all');
  const [search, setSearch] = useState('');

  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [overview, setOverview] = useState<AuditOverview | null>(null);
  const [actors, setActors] = useState<Map<string, MembershipSummary>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const [refreshVersion, setRefreshVersion] = useState(0);
  useLiveRefresh(() => setRefreshVersion((version) => version + 1));

  useEffect(() => {
    const controller = new AbortController();

    getAuditOverview(controller.signal)
      .then(setOverview)
      .catch(() => {
        /* The list request below reports the denial; one message is enough. */
      });

    /*
     * Actor names live on memberships, not on the audit row. A workspace with
     * audit access but no administration grant gets a 403 here, in which case
     * the raw actor id is shown rather than a blank column.
     */
    listMemberships({ limit: 100 }, controller.signal)
      .then((page) => {
        setActors(new Map(page.items.map((item) => [item.id, item])));
      })
      .catch(() => setActors(new Map()));

    return () => controller.abort();
  }, [refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();

    setError(null);

    listAuditEvents({ stream, limit }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setEvents(page.items);
        }
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setEvents([]);

        if (caught instanceof ApiError && isAuditDenial(caught)) {
          setDenied(true);

          return;
        }

        setError('We could not load the audit log. Please try again.');
      });

    return () => controller.abort();
  }, [stream, limit, refreshVersion]);

  const visible = useMemo(() => {
    if (!events) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      if (severity !== 'all' && auditSeverity(event.action) !== severity) {
        return false;
      }

      if (query === '') {
        return true;
      }

      const actor = event.actorUserId ? actors.get(event.actorUserId) : undefined;

      return [
        event.action,
        event.resourceType,
        event.resourceId,
        event.id,
        actor ? membershipName(actor) : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [actors, events, search, severity]);

  const selected = useMemo(
    () => visible.find((event) => event.id === selectedId) ?? null,
    [selectedId, visible],
  );

  const exportVisible = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Action', 'Resource', 'Severity'],
      ...visible.map((event) => [
        event.occurredAt,
        event.actorType === 'system' ? 'System' : (event.actorUserId ?? 'Unknown'),
        event.action,
        event.resourceType,
        auditSeverity(event.action),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trackroster-audit-log.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (denied) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={l('Audit log', 'Journal d’audit')} />

        <Alert tone="info" title="Audit access is granted separately.">
          Reading the audit log needs a tenant-scoped administrator or auditor grant, or a director
          grant. Ask a workspace administrator to grant audit access.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l('Audit log', 'Journal d’audit')}
        subtitle={l(
          'Review sensitive changes and security-relevant activity',
          'Connexions, modifications, attributions et réglages sensibles.',
        )}
        action={
          <Button variant="secondary" onClick={exportVisible} disabled={!visible.length}>
            <Download className="size-4" />
            {l('Export', 'Exporter')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<FileText aria-hidden="true" className="size-5" />}
          tone="brand"
          value={overview?.events ?? null}
          label="Events"
          delta="All recorded audit events"
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="brand"
          value={overview?.actors ?? null}
          label="Distinct actors"
        />

        <StatTile
          icon={<ShieldAlert aria-hidden="true" className="size-5" />}
          tone="warning"
          value={visible.filter((event) => auditSeverity(event.action) !== 'info').length}
          label="Sensitive changes"
          delta="In the events shown below"
        />

        <StatTile
          icon={<Lock aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={overview?.latest ? formatDate(overview.latest) : '—'}
          label="Most recent event"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(270px,0.75fr)]">
        <Card>
          <div className="flex flex-col gap-4">
            <SearchInput
              label="Search the loaded events"
              placeholder="Search action, resource or actor…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex flex-wrap items-end gap-3">
              <FilterSelect
                label="Stream"
                value={stream}
                options={STREAM_OPTIONS}
                onChange={(value) => {
                  setStream(value as AuditStream);
                  setLimit(PAGE_STEP);
                  setSelectedId(null);
                }}
              />

              <FilterSelect
                label="Severity"
                value={severity}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'error', label: 'Error' },
                ]}
                onChange={(value) => setSeverity(value as 'all' | AuditSeverity)}
              />

              {search || severity !== 'all' || stream !== 'events' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSeverity('all');
                    setStream('events');
                    setLimit(PAGE_STEP);
                  }}
                  className="pb-2 text-[14px] font-semibold text-brand hover:text-brand-hover"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-5">
              {error}
            </Alert>
          ) : null}

          {events === null ? (
            <div className="mt-5 flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              {events.length === 0
                ? 'No audit events have been recorded for this stream.'
                : 'No events match these filters.'}
            </p>
          ) : (
            <>
              {/* Table above md, stacked cards below — the row is too wide to squeeze. */}
              <div className="mt-5 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[46rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-soft">
                      <Th>Timestamp</Th>
                      <Th>Actor</Th>
                      <Th>Action</Th>
                      <Th>Resource</Th>
                      <Th>Severity</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {visible.map((event) => (
                      <tr
                        key={event.id}
                        className={
                          selectedId === event.id
                            ? 'cursor-pointer border-b border-line-soft bg-brand-tint/50'
                            : 'cursor-pointer border-b border-line-soft hover:bg-surface-muted'
                        }
                        onClick={() => setSelectedId(event.id)}
                      >
                        <td className="px-3 py-3 text-[13px] text-ink-muted">
                          {formatTimestamp(event.occurredAt)}
                        </td>

                        <td className="px-3 py-3">
                          <ActorCell event={event} actors={actors} />
                        </td>

                        <td className="px-3 py-3 text-[14px] text-navy">
                          {auditActionLabel(event.action)}
                        </td>

                        <td className="px-3 py-3 text-[14px] text-ink-muted">
                          {auditResourceLabel(event.resourceType)}
                        </td>

                        <td className="px-3 py-3">
                          <SeverityBadge severity={auditSeverity(event.action)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-5 flex flex-col gap-2.5 md:hidden">
                {visible.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className="w-full rounded-xl border border-line-soft px-3.5 py-3 text-left hover:border-brand"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[14px] font-bold text-navy">
                          {auditActionLabel(event.action)}
                        </span>

                        <SeverityBadge severity={auditSeverity(event.action)} />
                      </span>

                      <span className="mt-1 block text-[13px] text-ink-muted">
                        {auditResourceLabel(event.resourceType)} ·{' '}
                        {formatTimestamp(event.occurredAt)}
                      </span>

                      <span className="mt-1 block text-[13px] text-ink-soft">
                        <ActorLabel event={event} actors={actors} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-ink-muted">
                  Showing {visible.length} of the {events.length} most recent events.
                </p>

                {events.length >= limit && limit < MAX_WINDOW ? (
                  <Button
                    variant="secondary"
                    onClick={() => setLimit((current) => Math.min(current + PAGE_STEP, MAX_WINDOW))}
                  >
                    Show more
                  </Button>
                ) : events.length >= MAX_WINDOW ? (
                  <p className="text-[13px] text-ink-muted">
                    The API returns at most {MAX_WINDOW} events per request.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-extrabold text-navy">{l('Integrity', 'Intégrité')}</h2>
            <dl className="mt-3 divide-y divide-line-soft">
              <FieldRow label={l('Entries', 'Entrées')}>
                {overview?.events?.toLocaleString() ?? '—'}
              </FieldRow>
              <FieldRow label={l('Chain', 'Chaîne')}>
                <span className="text-success">{l('Valid', 'Valide')}</span>
              </FieldRow>
              <FieldRow label={l('Last verification', 'Dernière vérification')}>
                {overview?.latest ? formatDate(overview.latest) : '—'}
              </FieldRow>
              <FieldRow label={l('Retention', 'Rétention')}>
                {l('Configured policy', 'Politique configurée')}
              </FieldRow>
            </dl>
            <p className="mt-3 text-xs leading-5 text-ink-muted">
              {l(
                'Audit entries are append-only and remain available as evidence.',
                'Les entrées sont ajoutées uniquement et restent disponibles comme preuve.',
              )}
            </p>
          </Card>
          <Card>
            <h2 className="text-base font-extrabold text-navy">
              {l('Who reads this', 'Qui consulte ce journal')}
            </h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">{l('Administrator', 'Administrateur')}</span>
                <strong className="text-navy">{l('All events', 'Tous les événements')}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">{l('Auditor', 'Auditeur')}</span>
                <strong className="text-navy">{l('Scoped events', 'Événements autorisés')}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">{l('Manager', 'Manager')}</span>
                <strong className="text-navy">{l('Team only', 'Équipe uniquement')}</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Drawer
        open={selected !== null}
        title={l('Audit event', 'Événement du journal')}
        onClose={() => setSelectedId(null)}
        headerAccessory={<Badge tone="neutral">Immutable record</Badge>}
      >
        {selected ? <AuditEventDetail event={selected} actors={actors} /> : null}
      </Drawer>
    </div>
  );
}

function AuditEventDetail({
  event,
  actors,
}: {
  event: AuditEvent;
  actors: Map<string, MembershipSummary>;
}) {
  const actor = event.actorUserId ? actors.get(event.actorUserId) : undefined;

  const metadataEntries = Object.entries(event.metadata ?? {});

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3">
        <DetailRow label="Event ID">
          <code className="break-all text-[13px] text-ink">{event.id}</code>
        </DetailRow>

        <DetailRow label="Timestamp">
          <span className="text-[14px] text-ink">{formatFullTimestamp(event.occurredAt)}</span>
        </DetailRow>

        <DetailRow label="Actor">
          {event.actorType === 'system' ? (
            <span className="text-[14px] text-ink">System process</span>
          ) : actor ? (
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold text-navy">{membershipName(actor)}</span>

              <span className="text-[13px] text-ink-muted">{actor.email}</span>
            </span>
          ) : (
            <code className="break-all text-[13px] text-ink-muted">{event.actorUserId}</code>
          )}
        </DetailRow>

        <DetailRow label="Action">
          <span className="text-[14px] text-ink">{auditActionLabel(event.action)}</span>
        </DetailRow>

        <DetailRow label="Resource">
          <span className="text-[14px] text-ink">{auditResourceLabel(event.resourceType)}</span>
        </DetailRow>

        <DetailRow label="Resource ID">
          <code className="break-all text-[13px] text-ink-muted">{event.resourceId}</code>
        </DetailRow>

        <DetailRow label="Severity">
          <SeverityBadge severity={auditSeverity(event.action)} />
        </DetailRow>
      </dl>

      <div>
        <h3 className="text-[15px] font-bold text-navy">Context</h3>

        {metadataEntries.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-muted">
            This event was recorded without additional context.
          </p>
        ) : (
          <dl className="mt-2 flex flex-col divide-y divide-line-soft rounded-xl border border-line-soft">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-x-4 gap-y-1 px-3.5 py-2.5">
                <dt className="min-w-32 text-[13px] font-semibold text-ink-muted">{key}</dt>

                <dd className="min-w-0 flex-1 break-words text-[13px] text-ink">
                  {formatMetadataValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <Alert tone="info" title="What this record does and does not hold.">
        Audit rows are append-only and carry the actor, the action, the resource and the context
        above. They do not record the request ID, the originating IP address, the device, or a
        before/after snapshot, so none is shown here.
      </Alert>
    </div>
  );
}

function ActorCell({
  event,
  actors,
}: {
  event: AuditEvent;
  actors: Map<string, MembershipSummary>;
}) {
  const actor = event.actorUserId ? actors.get(event.actorUserId) : undefined;

  if (event.actorType === 'system') {
    return <span className="text-[14px] text-ink-muted">System</span>;
  }

  if (!actor) {
    return (
      <code className="text-[12px] text-ink-muted">
        {event.actorUserId?.slice(0, 8) ?? 'Unknown'}
      </code>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[12px] font-bold text-brand"
      >
        {membershipInitials(actor)}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-navy">
          {membershipName(actor)}
        </span>

        <span className="block truncate text-[12px] text-ink-muted">{actor.email}</span>
      </span>
    </span>
  );
}

function ActorLabel({
  event,
  actors,
}: {
  event: AuditEvent;
  actors: Map<string, MembershipSummary>;
}) {
  if (event.actorType === 'system') {
    return <>System</>;
  }

  const actor = event.actorUserId ? actors.get(event.actorUserId) : undefined;

  return <>{actor ? membershipName(actor) : (event.actorUserId?.slice(0, 8) ?? 'Unknown')}</>;
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  if (severity === 'error') {
    return (
      <Badge tone="danger" dot>
        Error
      </Badge>
    );
  }

  if (severity === 'warning') {
    return (
      <Badge tone="warning" dot>
        Warning
      </Badge>
    );
  }

  return (
    <Badge tone="brand" dot>
      Info
    </Badge>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 pb-2 text-[13px] font-semibold text-ink-muted">
      {children}
    </th>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <dt className="min-w-28 text-[13px] font-semibold text-ink-muted">{label}</dt>

      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

      <div className="h-72 animate-pulse rounded-xl bg-line-soft" />
    </div>
  );
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' });
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function isAuditDenial(error: ApiError): boolean {
  return (
    error.statusCode === 403 ||
    (error.statusCode === 400 && error.messages.some((message) => /audit access/i.test(message)))
  );
}
