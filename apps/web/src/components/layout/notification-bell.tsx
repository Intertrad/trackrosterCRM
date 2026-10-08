'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notification-client';
import { SEVERITY_TONE, type NotificationItem } from '@/lib/api/notification-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

const POLL_INTERVAL_MS = 60_000;

/*
 * The dossier requires collision, opposition and security alerts to stay
 * visible, so the unread count refreshes on a timer until a realtime channel
 * exists. Polling is deliberately slow — this is an awareness cue, not a feed.
 */
export function NotificationBell({ tone = 'light' }: { tone?: 'light' | 'dark' } = {}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const refreshCount = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const result = await getUnreadCount(signal);

      if (!signal?.aborted) {
        setCount(result.count);
      }
    } catch {
      /* An unavailable count must never break the shell. */
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void refreshCount(controller.signal);

    const timer = setInterval(() => void refreshCount(), POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    listNotifications({ readState: 'all', limit: 10 }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setItems(page.items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setItems([]);
        }
      });

    return () => controller.abort();
  }, [open]);

  async function readOne(notification: NotificationItem): Promise<void> {
    if (notification.readAt) {
      return;
    }

    setItems((current) =>
      (current ?? []).map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );

    try {
      await markNotificationRead(notification.id);
      await refreshCount();
    } catch {
      /* The server stays authoritative; the next poll corrects the count. */
      await refreshCount();
    }
  }

  async function readAll(): Promise<void> {
    try {
      await markAllNotificationsRead();

      setItems((current) =>
        (current ?? []).map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    } finally {
      await refreshCount();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={
          count > 0 ? t('common.notificationsUnread', { count }) : t('common.notifications')
        }
        className={cn(
          'relative flex size-9 items-center justify-center rounded-full transition-colors',
          tone === 'light'
            ? 'text-white/80 hover:bg-white/10 hover:text-white'
            : 'text-ink-muted hover:bg-surface-muted hover:text-navy',
        )}
      >
        <Bell aria-hidden="true" className="size-5" />

        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={t('common.closeNotifications')}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line-soft bg-surface shadow-overlay">
            <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
              <p className="text-[15px] font-bold text-navy">{t('common.notifications')}</p>

              <div className="flex items-center gap-3">
                {count > 0 ? (
                  <button
                    type="button"
                    onClick={() => void readAll()}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-hover"
                  >
                    <Check aria-hidden="true" className="size-4" />
                    {t('common.markAllRead')}
                  </button>
                ) : null}
                <Link
                  href="/workspace/notifications"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-hover"
                >
                  {t('common.viewAll')} <ExternalLink aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </div>

            {items === null ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-ink-muted">
                {t('common.nothingToCatchUp')}
              </p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-line-soft overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void readOne(item)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted',
                        !item.readAt && 'bg-brand-wash',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-navy">
                          {item.title}
                        </span>

                        {item.message ? (
                          <span className="block truncate text-[13px] text-ink-muted">
                            {item.message}
                          </span>
                        ) : null}
                      </span>

                      {item.severity !== 'info' ? (
                        <Badge tone={SEVERITY_TONE[item.severity]}>{item.severity}</Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
