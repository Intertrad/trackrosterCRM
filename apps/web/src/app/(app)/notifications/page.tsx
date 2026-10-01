'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  Info,
  Settings2,
  ShieldAlert,
  UploadCloud,
  Zap,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notification-client';
import {
  SEVERITY_TONE,
  type NotificationItem,
  type NotificationSeverity,
} from '@/lib/api/notification-types';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { cn } from '@/lib/ui/cn';

type ReadFilter = 'all' | 'unread' | 'read';

const FILTERS: Array<{ id: ReadFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: 'Normal',
  warning: 'High',
  error: 'High',
  critical: 'Critical',
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<ReadFilter>('all');
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const [pageResult, unreadResult] = await Promise.allSettled([
        listNotifications({ readState: filter, limit: 100 }, signal),
        getUnreadCount(signal),
      ]);

      if (signal?.aborted) return;

      const errors = [pageResult, unreadResult].filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      if (pageResult.status === 'fulfilled') {
        setItems(pageResult.value.items);
      } else {
        /* Do not replace a previously loaded inbox with a skeleton on refresh. */
        setItems((current) => current ?? []);
      }

      if (unreadResult.status === 'fulfilled') {
        setUnreadCount(unreadResult.value.count);
      }

      if (errors.length === 0) {
        setError(null);
        return;
      }

      const unauthorized = errors.some(
        (result) => result.reason instanceof ApiError && result.reason.statusCode === 401,
      );

      setError(
        unauthorized
          ? 'Your session has expired. Please sign in again.'
          : pageResult.status === 'rejected'
            ? 'We could not load notifications. Please try again.'
            : 'We could not refresh the notification count. Please try again.',
      );
    },
    [filter],
  );

  useLiveRefresh(load, { interval: 30_000, scope: 'notifications' });

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const unreadVisible = useMemo(() => (items ?? []).filter((item) => !item.readAt).length, [items]);

  async function readOne(item: NotificationItem): Promise<void> {
    if (busyId || item.readAt) return;

    setBusyId(item.id);
    setItems((current) =>
      (current ?? []).map((candidate) =>
        candidate.id === item.id ? { ...candidate, readAt: new Date().toISOString() } : candidate,
      ),
    );

    try {
      await markNotificationRead(item.id);
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function readAll(): Promise<void> {
    if (markingAll || unreadCount === 0) return;

    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((current) =>
        (current ?? []).map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      setError('We could not mark all notifications as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        subtitle="Prioritized — critical events first, no noise"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="md"
              disabled={markingAll || unreadCount === 0}
              loading={markingAll}
              leadingIcon={<CheckCheck aria-hidden="true" className="size-4" />}
              onClick={() => void readAll()}
            >
              Mark all as read
            </Button>
            <Link
              href="/profile?tab=notifications"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              <Settings2 aria-hidden="true" className="size-4" /> Preferences
            </Link>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger">
          {error}
          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)] xl:items-start">
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-5 text-brand" />
              <p className="text-[14px] font-bold text-navy">
                Inbox
                {unreadCount > 0 ? (
                  <span className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] text-brand">
                    {unreadCount} unread
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-surface-muted p-1" role="tablist">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[12px] font-bold transition-colors',
                    filter === option.id
                      ? 'bg-surface text-navy shadow-card'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {items === null ? (
            <NotificationSkeleton />
          ) : items.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onRead={() => void readOne(item)}
                />
              ))}
            </ul>
          )}

          {unreadVisible > 0 && filter === 'all' ? (
            <div className="border-t border-line-soft px-5 py-3 text-[12px] text-ink-muted">
              Unread notifications stay highlighted until you open them.
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-5">
          <Card padding="none" className="overflow-hidden">
            <CardHeader title="Priority rules" className="border-b border-line-soft px-5 py-4" />
            <div className="space-y-4 px-5 py-4 text-[13px]">
              <PriorityRow tone="danger" label="Critical" detail="Collision and security alerts" />
              <PriorityRow
                tone="warning"
                label="High"
                detail="Approvals, overdue follow-ups and inactivity"
              />
              <PriorityRow
                tone="neutral"
                label="Normal"
                detail="Reservations, imports and system events"
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <p className="text-[14px] font-semibold text-navy">Delivery preferences</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                  Choose email, push or in-app delivery by event in your profile settings. Critical
                  alerts remain enforced for every role.
                </p>
                <Link
                  href="/profile?tab=notifications"
                  className="mt-3 inline-flex text-[13px] font-bold text-brand hover:text-brand-hover"
                >
                  Manage preferences →
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  busy,
  onRead,
}: {
  item: NotificationItem;
  busy: boolean;
  onRead: () => void;
}) {
  const Icon = iconFor(item.type, item.severity);
  const href = item.followUpId ? '/follow-ups' : null;

  const content = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          item.severity === 'critical' || item.severity === 'error'
            ? 'bg-danger-bg text-danger'
            : item.severity === 'warning'
              ? 'bg-warning-bg text-warning'
              : 'bg-brand-tint text-brand',
        )}
      >
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-bold text-navy">{item.title}</span>
          {!item.readAt ? (
            <span className="size-1.5 rounded-full bg-brand" aria-label="Unread" />
          ) : null}
          <Badge tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Badge>
        </span>
        {item.message ? (
          <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">
            {item.message}
          </span>
        ) : null}
        <span className="mt-1.5 block text-[12px] text-ink-muted">
          {formatTimestamp(item.createdAt)}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 self-center">
        {item.readAt ? <Check aria-hidden="true" className="size-4 text-success" /> : null}
        <span className="text-[13px] font-bold text-brand">{busy ? 'Opening…' : 'Open'}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <li>
        <button
          type="button"
          onClick={onRead}
          disabled={busy}
          className={cn(
            'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-muted sm:px-5',
            !item.readAt && 'bg-brand-wash/50',
          )}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        onClick={onRead}
        aria-disabled={busy}
        className={cn(
          'flex items-start gap-3 px-4 py-4 transition-colors hover:bg-surface-muted sm:px-5',
          !item.readAt && 'bg-brand-wash/50',
        )}
      >
        {content}
      </Link>
    </li>
  );
}

function PriorityRow({
  tone,
  label,
  detail,
}: {
  tone: 'neutral' | 'warning' | 'danger';
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Badge tone={tone} dot>
        {label}
      </Badge>
      <p className="pt-0.5 text-ink-muted">{detail}</p>
    </div>
  );
}

function EmptyState({ filter }: { filter: ReadFilter }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
        <CheckCheck aria-hidden="true" className="size-6" />
      </span>
      <h2 className="mt-4 text-[16px] font-bold text-navy">
        {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
      </h2>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-muted">
        {filter === 'unread'
          ? 'New events will appear here when they need your attention.'
          : 'Notifications for your authorized workspace activity will appear here.'}
      </p>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex gap-3">
          <div className="size-9 animate-pulse rounded-lg bg-line-soft" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-line-soft" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-line-soft" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-line-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

function iconFor(type: string, severity: NotificationSeverity) {
  const normalized = type.toLowerCase();
  if (severity === 'critical' || normalized.includes('collision')) return ShieldAlert;
  if (normalized.includes('approval') || normalized.includes('override')) return AlertTriangle;
  if (normalized.includes('follow')) return CalendarDays;
  if (normalized.includes('reservation')) return Clock3;
  if (normalized.includes('import')) return UploadCloud;
  if (normalized.includes('activity')) return Zap;
  return Info;
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;

  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  const absolute = Math.abs(minutes);
  if (absolute < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(days, 'day');
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
