'use client';

import { useCallback, useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getAccountSessions, revokeOtherSessions, revokeSession } from '@/lib/api/account-client';
import type { AccountSession } from '@/lib/api/account-types';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function SessionsTab() {
  const { t, locale } = useTranslation();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const page = await getAccountSessions(signal);

        setSessions(page.items);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? t('common.sessionExpired')
            : t('account.sessions.loadError'),
        );
      }
    },
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  async function handleRevoke(sessionId: string): Promise<void> {
    setPendingId(sessionId);
    setNotice(null);

    try {
      await revokeSession(sessionId);

      setNotice(t('account.sessions.signedOut'));

      await load();
    } catch {
      setError(t('account.sessions.revokeError'));
    } finally {
      setPendingId(null);
    }
  }

  async function handleRevokeOthers(): Promise<void> {
    setRevokingOthers(true);
    setNotice(null);

    try {
      const result = await revokeOtherSessions();

      setNotice(
        result.revoked === 0
          ? t('account.sessions.noOthers')
          : t('account.sessions.signedOutOthers', { count: result.revoked }),
      );

      await load();
    } catch {
      setError(t('account.sessions.revokeOthersError'));
    } finally {
      setRevokingOthers(false);
    }
  }

  const otherCount = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <Card>
      <CardHeader
        title={t('account.sessions.title')}
        action={
          <Button
            variant="secondary"
            size="md"
            loading={revokingOthers}
            disabled={otherCount === 0}
            onClick={() => void handleRevokeOthers()}
          >
            {t('account.sessions.signOutOthers')}
          </Button>
        }
      />

      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {notice ? (
        <Alert tone="success" className="mb-4">
          {notice}
        </Alert>
      ) : null}

      {sessions === null ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-[14px] text-ink-muted">{t('account.sessions.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft px-3 py-3"
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted"
              >
                <Monitor className="size-[18px] text-ink-muted" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-navy">
                  {t('account.sessions.signedIn', {
                    date: formatDateTime(session.createdAt, locale),
                  })}
                </span>

                <span className="block text-[13px] text-ink-muted">
                  {t('account.sessions.expires', {
                    date: formatDateTime(session.expiresAt, locale),
                  })}
                </span>
              </span>

              {session.current ? (
                <Badge tone="success" dot>
                  {t('account.sessions.thisDevice')}
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  loading={pendingId === session.id}
                  disabled={pendingId !== null}
                  onClick={() => void handleRevoke(session.id)}
                >
                  {t('account.sessions.signOut')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The API returns sessions for the current workspace only, and records
          no device or location metadata, so neither is shown rather than
          guessed from a value the server does not have. */}
      <p className="mt-4 text-[13px] text-ink-muted">{t('account.sessions.workspaceNote')}</p>
    </Card>
  );
}

function formatDateTime(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale || undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
