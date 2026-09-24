'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import {
  cancelProspectFollowUp,
  completeProspectFollowUp,
  listFollowUpQueue,
} from '@/lib/api/follow-up-client';
import type { FollowUpQueueItem } from '@/lib/api/follow-up-types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

type TabId = 'todo' | 'overdue' | 'completed';

export default function ActionsPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [tab, setTab] = useState<TabId>('todo');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<FollowUpQueueItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /*
   * Read failures and action failures are tracked separately: reloading the
   * queue after a bulk write must not erase the report of which writes failed.
   */
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * An idempotency key is minted once per follow-up and reused until that
   * write succeeds. A network failure is ambiguous — the server may already
   * have completed the follow-up — so retrying with a fresh key could apply
   * the same completion twice.
   */
  const idempotencyKeys = useRef(new Map<string, string>());

  const keyFor = useCallback((followUpId: string): string => {
    const existing = idempotencyKeys.current.get(followUpId);

    if (existing) {
      return existing;
    }

    const key = crypto.randomUUID();
    idempotencyKeys.current.set(followUpId, key);

    return key;
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return;
      }

      try {
        const response = await listFollowUpQueue({
          teamId,
          limit: 100,
          ...(tab === 'overdue' ? { overdue: true } : {}),
          signal,
        });

        if (signal?.aborted) {
          return;
        }

        setItems(response.items);
        setReadError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setReadError(
          caught instanceof ApiError && caught.statusCode === 401
            ? 'Your session has expired. Please sign in again.'
            : 'We could not load your actions. Please try again.',
        );
      }
    },
    [tab, teamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    setSelected(new Set());
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    if (!items) {
      return [];
    }

    const byTab = items.filter((item) =>
      tab === 'completed' ? item.status === 'completed' : item.status === 'pending',
    );

    const query = search.trim().toLowerCase();

    if (!query) {
      return byTab;
    }

    return byTab.filter(
      (item) =>
        item.establishmentName.toLowerCase().includes(query) ||
        item.campaignName.toLowerCase().includes(query),
    );
  }, [items, search, tab]);

  const counts = useMemo(() => {
    const all = items ?? [];
    const now = Date.now();

    return {
      todo: all.filter((item) => item.status === 'pending').length,
      overdue: all.filter(
        (item) => item.status === 'pending' && new Date(item.dueAt).getTime() < now,
      ).length,
      completed: all.filter((item) => item.status === 'completed').length,
    };
  }, [items]);

  function toggle(id: string): void {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function runBulk(action: 'complete' | 'cancel'): Promise<void> {
    if (!teamId || selected.size === 0) {
      return;
    }

    setBusy(true);
    setActionError(null);
    setNotice(null);

    const targets = visible.filter((item) => selected.has(item.id));

    let succeeded = 0;

    /*
     * There is no bulk endpoint yet, so each follow-up is completed
     * individually with its own idempotency key. Failures are counted rather
     * than aborting the batch, so one rejected row cannot strand the rest.
     */
    for (const item of targets) {
      try {
        const request = {
          campaignId: item.campaignId,
          prospectId: item.prospectId,
          followUpId: item.id,
          teamId,
          idempotencyKey: keyFor(item.id),
        };

        if (action === 'complete') {
          await completeProspectFollowUp(request);
        } else {
          await cancelProspectFollowUp(request);
        }

        /* Only a confirmed success may retire the key. */
        idempotencyKeys.current.delete(item.id);
        succeeded += 1;
      } catch {
        /* Keep the key so a retry is the same logical write. */
      }
    }

    setBusy(false);
    setSelected(new Set());

    const verb = action === 'complete' ? 'completed' : 'cancelled';

    if (succeeded === targets.length) {
      setNotice(`${succeeded} action${succeeded === 1 ? '' : 's'} ${verb}.`);
    } else {
      setActionError(`${succeeded} of ${targets.length} actions ${verb}. Please retry the rest.`);
    }

    await load();
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Actions" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to manage your actions.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actions"
        subtitle="Manage your calls, emails, visits and follow-ups"
        action={
          /* The history of completed work and the round planner are no longer
             in the prospector sidebar, so this is where they are reached. */
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/actions">Logged actions</LinkButton>

            <LinkButton href="/routes">Routes</LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <SearchInput
          label="Search actions"
          placeholder="Search actions..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'todo', label: 'To do' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'Completed' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors',
              tab === item.id
                ? 'bg-brand-tint text-brand'
                : 'bg-surface-muted text-ink-soft hover:text-ink',
            )}
          >
            {item.label}

            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[12px] font-bold',
                item.id === 'overdue' && counts.overdue > 0
                  ? 'bg-danger text-white'
                  : tab === item.id
                    ? 'bg-brand text-white'
                    : 'bg-line-soft text-ink-soft',
              )}
            >
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {readError ? <Alert tone="danger">{readError}</Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {items === null ? (
        <QueueSkeleton />
      ) : visible.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success" />

            <p className="mt-3 text-[17px] font-bold text-navy">
              {search ? 'No actions match your search' : 'Nothing in this list'}
            </p>

            <p className="mt-1 text-[14px] text-ink-muted">
              {tab === 'overdue'
                ? 'You have no overdue follow-ups.'
                : 'New follow-ups appear here when they are created.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-line-soft">
            {visible.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </ul>
        </Card>
      )}

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised lg:bottom-6"
        >
          <span className="text-[15px] font-semibold text-navy">
            {selected.size} action{selected.size === 1 ? '' : 's'} selected
          </span>

          <Button
            variant="secondary"
            size="md"
            loading={busy}
            leadingIcon={<CheckCircle2 aria-hidden="true" className="size-[18px]" />}
            onClick={() => void runBulk('complete')}
          >
            Mark completed
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={busy}
            onClick={() => void runBulk('cancel')}
          >
            Cancel actions
          </Button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="ml-auto text-ink-muted hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ActionRow({
  item,
  selected,
  onToggle,
}: {
  item: FollowUpQueueItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const overdue = item.status === 'pending' && new Date(item.dueAt).getTime() < Date.now();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Select follow-up for ${item.establishmentName}`}
        className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line bg-surface checked:border-brand checked:bg-brand"
      />

      <span
        className={cn('w-24 shrink-0 text-[14px] font-bold', overdue ? 'text-danger' : 'text-ink')}
      >
        {formatDate(item.dueAt)}

        <span className="block text-[13px] font-medium text-ink-muted">
          {overdue ? 'Overdue' : formatTime(item.dueAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1 basis-48">
        <Link
          href={`/work-queue/${item.campaignId}/${item.prospectId}`}
          className="block truncate text-[15px] font-bold text-navy hover:text-brand"
        >
          {item.establishmentName}
        </Link>

        <span className="block truncate text-[14px] text-ink-muted">{item.campaignName}</span>
      </span>

      <Badge tone={item.ownership === 'team' ? 'brand' : 'neutral'} className="shrink-0">
        {item.ownership === 'team' ? 'Team' : 'You'}
      </Badge>

      <Badge tone={overdue ? 'danger' : item.status === 'completed' ? 'success' : 'neutral'}>
        {item.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Open'}
      </Badge>
    </li>
  );
}

function QueueSkeleton() {
  return (
    <Card className="p-0 sm:p-0" aria-busy="true">
      <span className="sr-only">Loading your actions…</span>

      <ul className="divide-y divide-line-soft">
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="flex animate-pulse items-center gap-4 px-6 py-5">
            <span className="size-[18px] rounded bg-line-soft" />
            <span className="h-5 w-20 rounded bg-line-soft" />
            <span className="h-5 flex-1 rounded bg-line-soft" />
            <span className="h-6 w-20 rounded-md bg-line-soft" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
}
