'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clipboard,
  Download,
  FileDown,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select-field';
import { useAuth } from '@/lib/auth/auth-context';
import type { AuditEvent } from '@/lib/api/audit-types';
import { auditActionLabel, auditResourceLabel } from '@/lib/api/audit-types';
import type { ActionRecord, ActionType, OutcomeCode } from '@/lib/api/action-types';
import { actionTypeLabel, OUTCOME_LABELS } from '@/lib/api/action-types';
import type { Prospect } from '@/lib/api/prospect-types';
import {
  createObserverEvidenceExport,
  getObserverAuditEvent,
  listObserverActions,
  listObserverAudit,
  listObserverProspects,
  type EvidenceExport,
} from '@/lib/api/observer-client';
import { getWorkspaceScopeLabel } from '@/lib/auth/workspace';

const formatDate = (value: string | null | undefined, locale = 'en-US') =>
  value
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The scoped data could not be loaded.';
}

function ScopeBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-line bg-brand-tint px-4 py-3 text-[13px] text-ink">
      <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
      <p>{children}</p>
    </div>
  );
}

function ObserverLayout({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useAuth();
  const scope = activeWorkspace
    ? getWorkspaceScopeLabel(activeWorkspace.scopeType)
    : 'Authorized scope';
  const identifiers = [activeWorkspace?.organizationId, activeWorkspace?.teamId].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <ScopeBanner>
        Read-only observer scope · {scope}
        {identifiers.length ? ` · ${identifiers.join(' · ')}` : ''}. Contact details are masked and
        every export is logged.
      </ScopeBanner>
      {children}
    </div>
  );
}

function ObserverExportButton({
  resourceTypes,
  actions,
  reason,
  label = 'Export the scope',
}: {
  resourceTypes: string[];
  actions?: string[];
  reason: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function exportScope() {
    setLoading(true);
    setError(null);
    try {
      await createObserverEvidenceExport({
        resourceTypes,
        ...(actions ? { actions } : {}),
        reason,
      });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <Button
        onClick={exportScope}
        loading={loading}
        leadingIcon={done ? <Check className="size-4" /> : <Download className="size-4" />}
      >
        {done ? 'Export requested' : label}
      </Button>
      {error ? <span className="max-w-[240px] text-right text-xs text-danger">{error}</span> : null}
    </div>
  );
}

export function ObserverAuditPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setEvents((await listObserverAudit('events', 100, signal)).items);
    } catch (caught) {
      if (!signal?.aborted) setError(errorMessage(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const filtered = events.filter((event) =>
    `${event.action} ${event.resourceType} ${event.resourceId}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <ObserverLayout>
      <PageHeader
        title="Audit log"
        subtitle={`${events.length || '—'} events in your authorized scope · read-only`}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw className="size-4" />}
              onClick={() => void load()}
            >
              Refresh
            </Button>
            <ObserverExportButton resourceTypes={['export']} reason="Observer audit scope export" />
          </div>
        }
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-line-soft p-4">
            <SearchInput
              label="Search audit events"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery('')}
              placeholder="Search actor, event or object…"
            />
          </div>
          {error ? (
            <div className="p-4">
              <Alert tone="danger" title="Audit log unavailable">
                {error}
              </Alert>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Object</th>
                  <th className="px-4 py-3">Proof</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-ink-muted">
                      Loading scoped events…
                    </td>
                  </tr>
                ) : (
                  filtered.map((event) => (
                    <tr
                      key={event.id}
                      className="cursor-pointer border-t border-line-soft hover:bg-surface-muted"
                      onClick={() => setSelected(event)}
                    >
                      <td className="px-4 py-3 font-semibold text-navy">
                        {formatDate(event.occurredAt, user?.locale)}
                      </td>
                      <td className="px-4 py-3">
                        {event.actorType === 'system' ? 'Engine' : 'Scoped member'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="brand">{event.action}</Badge>
                      </td>
                      <td className="max-w-[300px] truncate px-4 py-3">
                        {auditResourceLabel(event.resourceType)} · {event.resourceId}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="success" dot>
                          Recorded
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Integrity" />
          <dl className="divide-y divide-line-soft">
            <FieldRow label="Visible events">{events.length}</FieldRow>
            <FieldRow label="Scope">Read-only</FieldRow>
            <FieldRow label="Contact data">Masked</FieldRow>
            <FieldRow label="Proof">Immutable record</FieldRow>
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
            Opening an event is itself a read operation. The API keeps the original event and its
            identifier available for evidence export.
          </p>
        </Card>
      </div>
      <AuditDrawer event={selected} onClose={() => setSelected(null)} locale={user?.locale} />
    </ObserverLayout>
  );
}

function AuditDrawer({
  event,
  onClose,
  locale,
}: {
  event: AuditEvent | null;
  onClose: () => void;
  locale?: string;
}) {
  const [detail, setDetail] = useState<AuditEvent | null>(event);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setDetail(event);
    if (!event) return;
    setLoading(true);
    void getObserverAuditEvent(event.id)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [event]);
  const metadata = detail?.metadata ?? {};
  const value = (key: string) => (typeof metadata[key] === 'string' ? String(metadata[key]) : null);
  return (
    <Drawer
      open={Boolean(event)}
      title={detail ? auditActionLabel(detail.action) : 'Event detail'}
      onClose={onClose}
      footer={
        detail ? (
          <div className="flex flex-wrap gap-2">
            <ObserverExportButton
              resourceTypes={['export']}
              reason={`Evidence for audit event ${detail.id}`}
              label="Export this event"
            />
            <Button
              variant="secondary"
              leadingIcon={<Clipboard className="size-4" />}
              onClick={() => void navigator.clipboard?.writeText(detail.id)}
            >
              Copy reference
            </Button>
          </div>
        ) : null
      }
    >
      {loading ? (
        <p className="text-sm text-ink-muted">Loading event detail…</p>
      ) : detail ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-muted">
              Event {detail.id} · {formatDate(detail.occurredAt, locale)}
            </p>
            <Badge tone="success">PROOF OK</Badge>
          </div>
          <Card>
            <CardHeader title="Who and what" />
            <dl className="divide-y divide-line-soft">
              <FieldRow label="Actor">
                {detail.actorType === 'system' ? 'Engine' : 'Scoped member'}
              </FieldRow>
              <FieldRow label="Object">{auditResourceLabel(detail.resourceType)}</FieldRow>
              <FieldRow label="Reference">{detail.resourceId}</FieldRow>
              <FieldRow label="Decision">
                {value('decision') ?? auditActionLabel(detail.action)}
              </FieldRow>
            </dl>
          </Card>
          {value('reason') || value('summary') ? (
            <Card>
              <CardHeader title="Stated reason" />
              <p className="rounded-lg border border-line-soft bg-surface-muted p-3 text-sm text-ink">
                {value('reason') ?? value('summary')}
              </p>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Integrity" />
            <p className="text-sm leading-relaxed text-ink-muted">
              Immutable audit record. Contact names, phone numbers and e-mail addresses remain
              masked in this role.
            </p>
            <p className="mt-3 break-all font-mono text-xs text-ink-muted">
              Reference: {detail.id}
            </p>
          </Card>
        </div>
      ) : null}
    </Drawer>
  );
}

const outcomeTone = (outcome: string | null) =>
  outcome === 'no_answer' || outcome === 'do_not_contact'
    ? 'warning'
    : outcome === 'completed' || outcome === 'contacted' || outcome === 'qualified'
      ? 'success'
      : 'brand';

export function ObserverActionsPage() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setActions((await listObserverActions({}, signal)).items);
    } catch (caught) {
      if (!signal?.aborted) setError(errorMessage(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const visible = actions.filter(
    (action) =>
      (channel === 'all' || action.type === channel) &&
      (outcome === 'all' || action.outcomeCode === outcome),
  );
  return (
    <ObserverLayout>
      <PageHeader
        title="Actions"
        subtitle={`${actions.length || '—'} actions in your scope · summaries visible, contact details masked`}
        action={
          <ObserverExportButton
            resourceTypes={[]}
            actions={['action.logged', 'action.completed', 'action.corrected']}
            reason="Observer actions scope export"
          />
        }
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Card className="mb-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label="Outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                options={[
                  { value: 'all', label: 'All outcomes' },
                  ...Object.entries(OUTCOME_LABELS).map(([value, label]) => ({ value, label })),
                ]}
              />
              <SelectField
                label="Channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                options={[
                  { value: 'all', label: 'All channels' },
                  ...(['call', 'email', 'message', 'visit'] as ActionType[]).map((value) => ({
                    value,
                    label: actionTypeLabel(value),
                  })),
                ]}
              />
              <SelectField
                label="Period"
                value="30"
                disabled
                options={[{ value: '30', label: 'Last 30 days' }]}
              />
            </div>
          </Card>
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Establishment</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Author</th>
                    <th className="px-4 py-3">Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-ink-muted">
                        Loading scoped actions…
                      </td>
                    </tr>
                  ) : (
                    visible.map((action) => (
                      <tr key={action.id} className="border-t border-line-soft">
                        <td className="px-4 py-3 font-semibold text-navy">
                          {formatDate(action.completedAt ?? action.dueAt, user?.locale)}
                        </td>
                        <td className="px-4 py-3">
                          {action.establishment.name ?? 'Masked establishment'}
                        </td>
                        <td className="px-4 py-3">{actionTypeLabel(action.type)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={outcomeTone(action.outcomeCode)}>
                            {action.outcomeCode
                              ? (OUTCOME_LABELS[action.outcomeCode as OutcomeCode] ??
                                action.outcomeCode)
                              : 'Open'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {action.actor.displayName ? 'Prospector' : 'Scoped member'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="success" dot>
                            Recorded
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Outcomes in the period" />
            {Object.entries(OUTCOME_LABELS)
              .slice(0, 5)
              .map(([code, label]) => (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 text-sm"
                >
                  <span>{label}</span>
                  <span className="font-bold text-navy">
                    {actions.filter((item) => item.outcomeCode === code).length}
                  </span>
                </div>
              ))}
          </Card>
          <Card>
            <CardHeader title="Compliance checks" />
            <dl className="divide-y divide-line-soft">
              <FieldRow label="Actions with a summary">Recorded in API</FieldRow>
              <FieldRow label="Scoped visibility">Enforced</FieldRow>
              <FieldRow label="Contact details">Masked</FieldRow>
              <FieldRow label="Writes from observer">Blocked</FieldRow>
            </dl>
          </Card>
        </div>
      </div>
      {error ? (
        <div className="mt-4">
          <Alert tone="danger" title="Actions unavailable">
            {error}
          </Alert>
        </div>
      ) : null}
    </ObserverLayout>
  );
}

function maskedPhone(phone: string | null) {
  return phone ? '•• •• •• •• ••' : '—';
}
function observerOwner(prospect: Prospect, index: number) {
  return prospect.assignments?.find((assignment) => assignment.assignedUserId)?.assignedUserName
    ? `Prospector ${String.fromCharCode(65 + (index % 6))}`
    : 'Unassigned';
}

export function ObserverProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setProspects((await listObserverProspects({}, signal)).items);
    } catch (caught) {
      if (!signal?.aborted) setError(errorMessage(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const visible = prospects.filter((prospect) =>
    `${prospect.name} ${prospect.city ?? ''} ${prospect.postalCode ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <ObserverLayout>
      <PageHeader
        title="Prospects"
        subtitle={`${prospects.length || '—'} establishments in your scope · contact details are masked`}
        action={
          <ObserverExportButton
            resourceTypes={['prospect']}
            reason="Observer prospects scope export"
          />
        }
      />
      <div className="mt-5">
        <Card className="mb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <SearchInput
                label="Search scoped prospects"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
                placeholder="Search establishment or city…"
              />
            </div>
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <ShieldCheck className="size-4 text-success" /> Names, statuses and action counts
              visible
            </p>
          </div>
        </Card>
        {error ? (
          <Alert tone="danger" title="Prospects unavailable">
            {error}
          </Alert>
        ) : null}
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Establishment</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-ink-muted">
                        Loading scoped prospects…
                      </td>
                    </tr>
                  ) : (
                    visible.map((prospect, index) => (
                      <tr key={prospect.id} className="border-t border-line-soft">
                        <td className="px-4 py-3 font-semibold text-navy">{prospect.name}</td>
                        <td className="px-4 py-3">
                          {[prospect.postalCode, prospect.city].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                          {maskedPhone(prospect.phone)}
                        </td>
                        <td className="px-4 py-3">{observerOwner(prospect, index)}</td>
                        <td className="px-4 py-3">{prospect.assignments?.length ?? 0}</td>
                        <td className="px-4 py-3">
                          <Badge tone={prospect.status === 'active' ? 'success' : 'neutral'}>
                            {prospect.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="What is masked" />
            <p className="mb-3 text-sm text-ink-muted">
              Observers can verify activity and decisions without reusing the contact base.
            </p>
            <dl className="divide-y divide-line-soft">
              <FieldRow label="Contact person">
                <span className="text-danger">Masked</span>
              </FieldRow>
              <FieldRow label="Phone / e-mail">
                <span className="text-danger">Masked</span>
              </FieldRow>
              <FieldRow label="Owner">
                <span className="text-warning">Pseudonymised</span>
              </FieldRow>
              <FieldRow label="Actions and outcomes">
                <span className="text-success">Visible</span>
              </FieldRow>
              <FieldRow label="Decisions and authors">
                <span className="text-success">Visible</span>
              </FieldRow>
            </dl>
          </Card>
        </div>
      </div>
    </ObserverLayout>
  );
}

export function ObserverExportsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resource, setResource] = useState('events');
  const [period, setPeriod] = useState('30');
  const [format, setFormat] = useState('json');
  const [created, setCreated] = useState<EvidenceExport | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setEvents((await listObserverAudit('exports', 100, signal)).items);
    } catch (caught) {
      if (!signal?.aborted) setError(errorMessage(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function create() {
    setCreating(true);
    setError(null);
    try {
      setCreated(
        await createObserverEvidenceExport({
          resourceTypes: resource === 'events' || resource === 'action' ? ['export'] : ['prospect'],
          ...(resource === 'action'
            ? { actions: ['action.logged', 'action.completed', 'action.corrected'] }
            : {}),
          reason: `Observer ${resource} export · ${period} days · ${format}`,
        }),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }
  return (
    <ObserverLayout>
      <PageHeader
        title="Exports"
        subtitle="Evidence exports in your scope · each request is logged and expires after 24 hours"
        action={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-line-soft px-4 py-3 text-sm text-ink-muted">
            {events.length} logged export events
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Export event</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-ink-muted">
                      Loading export history…
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="border-t border-line-soft">
                      <td className="px-4 py-3 font-semibold text-navy">
                        {auditActionLabel(event.action)}
                      </td>
                      <td className="px-4 py-3">{auditResourceLabel(event.resourceType)}</td>
                      <td className="px-4 py-3">{formatDate(event.occurredAt)}</td>
                      <td className="px-4 py-3">
                        <Badge tone="success">Recorded</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="New export" />
            <div className="space-y-4">
              <SelectField
                label="Content"
                value={resource}
                onChange={(event) => setResource(event.target.value)}
                options={[
                  { value: 'events', label: 'Audit events' },
                  { value: 'action', label: 'Actions and outcomes' },
                  { value: 'prospect', label: 'Masked prospects' },
                ]}
              />
              <SelectField
                label="Period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                options={[
                  { value: '7', label: 'Last 7 days' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 90 days' },
                ]}
              />
              <SelectField
                label="Format"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                options={[
                  { value: 'json', label: 'Evidence JSON' },
                  { value: 'csv', label: 'CSV manifest' },
                ]}
              />
              <Button
                fullWidth
                loading={creating}
                leadingIcon={<FileDown className="size-4" />}
                onClick={create}
              >
                Generate the export
              </Button>
              {created ? (
                <Alert tone="success" title="Export requested">
                  Reference {created.id} is ready for the scoped evidence worker.
                </Alert>
              ) : null}
            </div>
          </Card>
          <Card>
            <CardHeader title="Rules" />
            <dl className="divide-y divide-line-soft">
              <FieldRow label="Masked fields">Never exported</FieldRow>
              <FieldRow label="Link validity">24 hours</FieldRow>
              <FieldRow label="Logged as">export.created</FieldRow>
            </dl>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
              The evidence endpoint enforces the observer scope on the server. Sharing a file
              outside the audit is a contractual matter; the file carries your account reference.
            </p>
          </Card>
        </div>
      </div>
      {error ? (
        <div className="mt-4">
          <Alert tone="danger" title="Exports unavailable">
            {error}
          </Alert>
        </div>
      ) : null}
    </ObserverLayout>
  );
}
