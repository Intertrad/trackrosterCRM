'use client';

import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { MfaCard } from '@/components/account/mfa-card';
import { getAccountProfile, getAccountSessions } from '@/lib/api/account-client';
import { requestPasswordReset } from '@/lib/api/auth-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function SecurityTab() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [sessionCount, setSessionCount] = useState<number | null>(null);

  /*
   * MFA state lives on the account profile (GET /me), not on the session
   * context, so it is read here rather than inferred from the auth context.
   */
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAccountSessions(controller.signal)
      .then((page) => setSessionCount(page.items.length))
      .catch(() => setSessionCount(null));

    getAccountProfile(controller.signal)
      .then(({ resource }) => setMfaEnabled(resource.mfaEnabled === true))
      .catch(() => setMfaEnabled(null));

    return () => controller.abort();
  }, []);

  async function handlePasswordReset(): Promise<void> {
    if (!user?.email) {
      return;
    }

    setResetting(true);
    setError(null);

    try {
      await requestPasswordReset(user.email);

      setResetSent(true);
    } catch {
      setError(t('account.security.resetError'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title={t('account.security.status')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatusTile
            icon={<KeyRound className="size-5 text-brand" />}
            label={t('account.security.password')}
            value={t('account.security.passwordValue')}
            detail={t('account.security.passwordDetail')}
          />

          <StatusTile
            icon={<ShieldCheck className="size-5 text-brand" />}
            label={t('account.security.sessions')}
            value={
              sessionCount === null
                ? t('account.security.sessionsUnavailable')
                : t('account.security.sessionCount', { count: sessionCount })
            }
            detail={t('account.security.workspaceOnly')}
          />
        </div>
      </Card>

      <MfaCard enabled={mfaEnabled === true} />

      <Card>
        <CardHeader title={t('account.security.passwordSection')} />

        <p className="text-[15px] text-ink-soft">
          TrackRoster sends a single-use link to{' '}
          <strong className="font-semibold text-ink">{user?.email ?? 'your work email'}</strong>.
          Setting a new password signs out your other sessions.
        </p>

        {error ? (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {resetSent ? (
          <Alert tone="success" className="mt-4" title={t('account.security.checkInbox')}>
            {t('account.security.resetSent')}
          </Alert>
        ) : (
          <Button
            variant="secondary"
            className="mt-4"
            loading={resetting}
            disabled={!user?.email}
            onClick={() => void handlePasswordReset()}
          >
            {t('account.security.sendReset')}
          </Button>
        )}
      </Card>

      <Card>
        <CardHeader title={t('account.security.mfa')} />

        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint"
          >
            <Smartphone className="size-5 text-brand" />
          </span>

          <div className="min-w-0 text-[15px] text-ink-soft">
            <p className="font-semibold text-navy">{t('account.security.authenticator')}</p>

            <p className="mt-1">{t('account.security.mfaBody')}</p>
          </div>
        </div>

        {/*
         * POST /auth/mfa/enroll, /recovery-codes/regenerate and DELETE /auth/mfa
         * all require the account password for step-up, and GET /me does not
         * report enrolment state. Showing an enable/disable control here would
         * imply a status the API cannot confirm.
         */}
        <Alert tone="info" className="mt-4" title={t('account.security.mfaUnavailable')}>
          {t('account.security.mfaUnavailableBody')}
        </Alert>
      </Card>
    </div>
  );
}

function StatusTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line-soft bg-surface-muted p-4">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface"
      >
        {icon}
      </span>

      <div className="min-w-0">
        <p className="text-[13px] text-ink-muted">{label}</p>

        <p className="text-[15px] font-bold text-navy">{value}</p>

        <p className="text-[13px] text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}
