'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { ApiError } from '@/lib/api/api-error';
import { selectWorkspace } from '@/lib/api/auth-client';
import {
  type StoredWorkspaceChallenge,
  challengeRoute,
  clearChallenges,
  readWorkspaceChallenge,
  storeChallenge,
} from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

export function WorkspaceSelector() {
  const router = useRouter();
  const { refreshSession } = useAuth();

  const [challenge, setChallenge] = useState<StoredWorkspaceChallenge | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readWorkspaceChallenge();

    if (!stored) {
      router.replace('/login');

      return;
    }

    setChallenge(stored);
    setReady(true);
  }, [router]);

  async function choose(membershipId: string): Promise<void> {
    if (!challenge || pendingId) {
      return;
    }

    setError(null);
    setPendingId(membershipId);

    try {
      const outcome = await selectWorkspace(challenge.selectionToken, membershipId);

      if (outcome.next !== 'authenticated') {
        storeChallenge(outcome);
        router.push(challengeRoute(outcome));

        return;
      }

      clearChallenges();

      const user = await refreshSession();

      if (!user) {
        setError('Your session could not be established. Please sign in again.');

        return;
      }

      router.replace('/');
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.statusCode === 410 || caught.statusCode === 404)) {
        /* The selection challenge is single-use and expires in five minutes. */
        clearChallenges();
        router.replace('/login');

        return;
      }

      setError('We could not open that workspace. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  if (!ready || !challenge) {
    return (
      <div className="animate-pulse" aria-busy="true">
        <div className="h-10 w-2/3 rounded bg-line-soft" />

        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-[74px] rounded-xl bg-line-soft" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-hover"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px]" />
        Back to sign in
      </Link>

      <header className="mt-6 mb-7">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Choose a workspace
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">
          Your identity has access to more than one workspace. Your role and navigation follow the
          workspace you open.
        </p>
      </header>

      {error ? (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-3">
        {challenge.memberships.map((membership) => {
          const isPending = pendingId === membership.membershipId;

          return (
            <li key={membership.membershipId}>
              <button
                type="button"
                onClick={() => void choose(membership.membershipId)}
                disabled={Boolean(pendingId)}
                aria-busy={isPending || undefined}
                className={cn(
                  'flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-4 text-left',
                  'transition-colors duration-150',
                  'hover:border-brand-pale hover:bg-brand-wash',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                  <Building2 aria-hidden="true" className="size-5 text-brand" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-navy">
                    {membership.tenantName}
                  </span>

                  {membership.displayName ? (
                    <span className="block truncate text-[14px] text-ink-muted">
                      {membership.displayName}
                    </span>
                  ) : null}
                </span>

                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
