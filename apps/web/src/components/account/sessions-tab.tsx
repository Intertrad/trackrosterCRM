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

export function SessionsTab() {
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
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
          ? 'Your session has expired. Please sign in again.'
          : 'We could not load your sessions. Please try again.',
      );
    }
  }, []);

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

      setNotice('That session was signed out.');

      await load();
    } catch {
      setError('We could not revoke that session. Please try again.');
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
          ? 'There were no other sessions to sign out.'
          : `Signed out ${result.revoked} other session${result.revoked === 1 ? '' : 's'}.`,
      );

      await load();
    } catch {
      setError('We could not revoke the other sessions. Please try again.');
    } finally {
      setRevokingOthers(false);
    }
  }

  const otherCount = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        action={
          <Button
            variant="secondary"
            size="md"
            loading={revokingOthers}
            disabled={otherCount === 0}
            onClick={() => void handleRevokeOthers()}
          >
            Sign out other sessions
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
        <p className="text-[14px] text-ink-muted">No active sessions in this workspace.</p>
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
                  Signed in {formatDateTime(session.createdAt)}
                </span>

                <span className="block text-[13px] text-ink-muted">
                  Expires {formatDateTime(session.expiresAt)}
                </span>
              </span>

              {session.current ? (
                <Badge tone="success" dot>
                  This device
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  loading={pendingId === session.id}
                  disabled={pendingId !== null}
                  onClick={() => void handleRevoke(session.id)}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The API returns sessions for the current workspace only, and records
          no device or location metadata, so neither is shown rather than
          guessed from a value the server does not have. */}
      <p className="mt-4 text-[13px] text-ink-muted">
        Sessions are listed for{' '}
        <strong className="font-semibold text-ink-soft">this workspace</strong> only. Signing out a
        session takes effect immediately and is recorded in the audit log.
      </p>
    </Card>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
