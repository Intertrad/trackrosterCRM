'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ShieldCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  getAccountMemberships,
  getAccountProfile,
  switchActiveMembership,
  updateAccountProfile,
} from '@/lib/api/account-client';
import type {
  AccountMembership,
  AccountProfile,
  UpdateAccountInput,
} from '@/lib/api/account-types';
import { clearChallenges } from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';
import { getInitials } from '@/lib/ui/initials';
import { LOCALE_OPTIONS, TIMEZONE_OPTIONS, withCurrentValue } from '@/lib/ui/locales';
import { notify } from '@/lib/notifications/notify';
import { useTranslation } from '@/lib/i18n/i18n-context';
import {
  getRoleLabel,
  getRolePermissionSummary,
  getRoleSummary,
  getScopeLabel,
} from '@/lib/ui/roles';

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'conflict' }
  | { kind: 'error'; message: string };

type EditableProfileField = 'displayName' | 'phone' | 'locale' | 'timezone';

const EDITABLE_PROFILE_FIELDS: EditableProfileField[] = [
  'displayName',
  'phone',
  'locale',
  'timezone',
];

export function ProfileTab() {
  const router = useRouter();
  const { refreshSession, updateUser } = useAuth();
  const { t, language } = useTranslation();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<AccountMembership[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState('');
  const [timezone, setTimezone] = useState('');

  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const [profileResult, membershipList] = await Promise.all([
          getAccountProfile(controller.signal),
          getAccountMemberships(controller.signal),
        ]);

        applyProfile(profileResult.resource, profileResult.etag);
        setMemberships(membershipList);
        setLoadError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(
          error instanceof ApiError && error.statusCode === 401
            ? t('common.sessionExpired')
            : t('account.profile.loadError'),
        );
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  function applyProfile(next: AccountProfile, nextEtag: string | null): void {
    setProfile(next);
    setEtag(nextEtag);
    setDisplayName(next.displayName ?? '');
    setPhone(next.phone ?? '');
    setLocale(next.locale);
    setTimezone(next.timezone);
  }

  const dirty = useMemo(() => {
    if (!profile) {
      return false;
    }

    return (
      displayName.trim() !== (profile.displayName ?? '') ||
      phone.trim() !== (profile.phone ?? '') ||
      locale !== profile.locale ||
      timezone !== profile.timezone
    );
  }, [displayName, locale, phone, profile, timezone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!profile || !dirty) {
      return;
    }

    setSave({ kind: 'saving' });

    /* Send only what changed, so an untouched field cannot overwrite a value
     * someone else updated between read and write. */
    const input = buildProfileUpdate(profile, { displayName, phone, locale, timezone });

    try {
      const result = await updateAccountProfile(input, etag);

      applyProfile(result.resource, result.etag);
      updateUser({ displayName: result.resource.displayName, locale: result.resource.locale });
      setSave({ kind: 'saved' });
      notify.success(t('account.profile.saved'), { id: 'profile-saved' });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 412) {
        /* A session refresh, a second tab, or an administrator edit can make
         * the form's validator stale. Re-read once and retry only when the
         * server changed fields other than the ones this form is saving. This
         * preserves optimistic concurrency while making a language-only change
         * reliable after a production session refresh. */
        try {
          const latest = await getAccountProfile();

          if (hasConcurrentProfileConflict(profile, latest.resource, input)) {
            setSave({ kind: 'conflict' });

            return;
          }

          const result = await updateAccountProfile(input, latest.etag);

          applyProfile(result.resource, result.etag);
          updateUser({ displayName: result.resource.displayName, locale: result.resource.locale });
          setSave({ kind: 'saved' });
          notify.success(t('account.profile.saved'), { id: 'profile-saved' });

          return;
        } catch (retryError) {
          if (retryError instanceof ApiError && retryError.statusCode !== 412) {
            setSave({
              kind: 'error',
              message: t('account.profile.saveError'),
            });

            return;
          }
        }

        setSave({ kind: 'conflict' });

        return;
      }

      setSave({
        kind: 'error',
        message:
          error instanceof ApiError && error.statusCode === 400
            ? t('account.profile.validationError')
            : t('account.profile.saveError'),
      });
    }
  }

  async function reloadAfterConflict(): Promise<void> {
    try {
      const result = await getAccountProfile();

      applyProfile(result.resource, result.etag);
      setSave({ kind: 'idle' });
    } catch {
      setSave({ kind: 'error', message: t('account.profile.reloadError') });
    }
  }

  async function handleSwitch(membershipId: string): Promise<void> {
    setSwitchingId(membershipId);

    try {
      const outcome = await switchActiveMembership(membershipId);

      if (outcome.next !== 'authenticated') {
        /* Switching can require a fresh challenge; restart the flow. */
        clearChallenges();
        router.replace('/login');

        return;
      }

      await refreshSession();
      router.refresh();
      notify.success(t('account.workspaceSwitched'), { id: 'workspace-switched' });
    } catch {
      setSave({ kind: 'error', message: t('common.switchWorkspaceError') });
    } finally {
      setSwitchingId(null);
    }
  }

  if (loadError) {
    return <Alert tone="danger">{loadError}</Alert>;
  }

  if (!profile) {
    return <ProfileSkeleton loadingLabel={t('account.profile.loading')} />;
  }

  const primaryGrant = profile.grants[0] ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader title={t('account.profile.personalInformation')} />

        <div className="mb-6 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[20px] font-bold text-brand"
          >
            {getInitials(profile.displayName, profile.email)}
          </span>

          <div className="min-w-0">
            <p className="truncate text-[20px] font-bold text-navy">
              {profile.displayName ?? profile.email}
            </p>

            {primaryGrant ? (
              <p className="text-[14px] text-ink-muted">
                {getRoleLabel(primaryGrant.role, language)}
              </p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t('account.profile.displayName')}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            disabled={save.kind === 'saving'}
            hint={t('account.profile.displayNameHint')}
          />

          <TextField
            label={t('account.profile.workEmail')}
            value={profile.email}
            readOnly
            disabled
            hint={t('account.profile.workEmailHint')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('account.profile.phone')}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              inputMode="tel"
              autoComplete="tel"
              disabled={save.kind === 'saving'}
            />

            <SelectField
              label={t('account.profile.language')}
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              options={withCurrentValue(LOCALE_OPTIONS, locale)}
              disabled={save.kind === 'saving'}
            />
          </div>

          <SelectField
            label={t('account.profile.timezone')}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            options={withCurrentValue(TIMEZONE_OPTIONS, timezone)}
            disabled={save.kind === 'saving'}
          />

          {save.kind === 'conflict' ? (
            <Alert tone="warning" title={t('account.profile.conflictTitle')}>
              {t('account.profile.conflictBody')}
              <Button
                variant="secondary"
                size="md"
                className="mt-3"
                onClick={() => void reloadAfterConflict()}
              >
                {t('account.profile.reload')}
              </Button>
            </Alert>
          ) : null}

          {save.kind === 'error' ? <Alert tone="danger">{save.message}</Alert> : null}

          <Button type="submit" fullWidth loading={save.kind === 'saving'} disabled={!dirty}>
            {t('account.profile.save')}
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={t('account.profile.currentAccess')} />

          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-bg"
            >
              <ShieldCheck className="size-6 text-success" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[18px] font-bold text-navy">
                  {primaryGrant
                    ? getRoleLabel(primaryGrant.role, language)
                    : t('account.profile.noRole')}
                </p>

                {primaryGrant ? (
                  <Badge tone="success">{t('account.profile.primaryRole')}</Badge>
                ) : null}
              </div>

              {primaryGrant ? (
                <p className="text-[14px] text-ink-muted">
                  {getRoleSummary(primaryGrant.role, language)}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="mt-5 divide-y divide-line-soft border-t border-line-soft pt-1">
            <FieldRow label={t('account.profile.workspace')}>{profile.tenantName}</FieldRow>

            {primaryGrant ? (
              <>
                <FieldRow label={t('account.profile.territoryScope')}>
                  {getScopeLabel(primaryGrant.scopeType, language)}
                </FieldRow>

                <FieldRow label={t('account.profile.permissionSummary')}>
                  {getRolePermissionSummary(primaryGrant.role, language) ?? '—'}
                </FieldRow>
              </>
            ) : null}

            {profile.grants.length > 1 ? (
              <FieldRow label={t('account.profile.additionalGrants')}>
                {profile.grants
                  .slice(1)
                  .map((grant) => getRoleLabel(grant.role, language))
                  .join(', ')}
              </FieldRow>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader title={t('account.profile.memberships')} />

          {memberships === null ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1].map((index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : memberships.length === 0 ? (
            <p className="text-[14px] text-ink-muted">{t('account.profile.noOtherWorkspaces')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {memberships.map((membership) => (
                <li
                  key={membership.membershipId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft px-3 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-tint"
                  >
                    <Building2 className="size-[18px] text-brand" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {membership.tenantName}
                    </span>

                    {membership.roles.length > 0 ? (
                      <span className="block truncate text-[13px] text-ink-muted">
                        {membership.roles.map((role) => getRoleLabel(role, language)).join(', ')}
                      </span>
                    ) : null}
                  </span>

                  {membership.current ? (
                    <Badge tone="success" dot>
                      {t('account.profile.active')}
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      loading={switchingId === membership.membershipId}
                      disabled={switchingId !== null}
                      onClick={() => void handleSwitch(membership.membershipId)}
                    >
                      {t('account.profile.open')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* GET /me/memberships filters to status = 'active', so invited and
              suspended memberships in the design cannot be listed yet. */}
          <p className="mt-4 text-[13px] text-ink-muted">{t('account.profile.membershipsHint')}</p>
        </Card>
      </div>
    </div>
  );
}

function buildProfileUpdate(
  profile: AccountProfile,
  values: Pick<ProfileFormValues, EditableProfileField>,
): UpdateAccountInput {
  return {
    ...(values.displayName.trim() !== (profile.displayName ?? '')
      ? { displayName: values.displayName.trim() }
      : {}),
    ...(values.phone.trim() !== (profile.phone ?? '')
      ? { phone: values.phone.trim() === '' ? null : values.phone.trim() }
      : {}),
    ...(values.locale !== profile.locale ? { locale: values.locale } : {}),
    ...(values.timezone !== profile.timezone ? { timezone: values.timezone } : {}),
  };
}

function hasConcurrentProfileConflict(
  original: AccountProfile,
  latest: AccountProfile,
  input: UpdateAccountInput,
): boolean {
  return EDITABLE_PROFILE_FIELDS.some((field) => {
    const desired = input[field];

    if (desired === undefined) {
      return false;
    }

    const originalValue = original[field] ?? null;
    const latestValue = latest[field] ?? null;

    return latestValue !== originalValue && latestValue !== desired;
  });
}

interface ProfileFormValues {
  displayName: string;
  phone: string;
  locale: string;
  timezone: string;
}

function ProfileSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">{loadingLabel}</span>

      {[0, 1].map((column) => (
        <div
          key={column}
          className="animate-pulse rounded-xl border border-line-soft bg-surface p-6"
        >
          <div className="h-6 w-40 rounded bg-line-soft" />

          <div className="mt-6 flex flex-col gap-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 rounded-lg bg-line-soft" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
