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
import type { AccountMembership, AccountProfile } from '@/lib/api/account-types';
import { clearChallenges } from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';
import { getInitials } from '@/lib/ui/initials';
import { LOCALE_OPTIONS, TIMEZONE_OPTIONS, withCurrentValue } from '@/lib/ui/locales';
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

export function ProfileTab() {
  const router = useRouter();
  const { refreshSession } = useAuth();

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
            ? 'Your session has expired. Please sign in again.'
            : 'We could not load your account. Please try again.',
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

    try {
      /* Send only what changed, so an untouched field cannot overwrite a
       * value someone else updated between read and write. */
      const result = await updateAccountProfile(
        {
          ...(displayName.trim() !== (profile.displayName ?? '')
            ? { displayName: displayName.trim() }
            : {}),
          ...(phone.trim() !== (profile.phone ?? '')
            ? { phone: phone.trim() === '' ? null : phone.trim() }
            : {}),
          ...(locale !== profile.locale ? { locale } : {}),
          ...(timezone !== profile.timezone ? { timezone } : {}),
        },
        etag,
      );

      applyProfile(result.resource, result.etag);
      setSave({ kind: 'saved' });

      /* The shell shows the display name, so refresh the session context. */
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 412) {
        setSave({ kind: 'conflict' });

        return;
      }

      setSave({
        kind: 'error',
        message:
          error instanceof ApiError && error.statusCode === 400
            ? 'Please check the highlighted fields and try again.'
            : 'We could not save your changes. Please try again.',
      });
    }
  }

  async function reloadAfterConflict(): Promise<void> {
    try {
      const result = await getAccountProfile();

      applyProfile(result.resource, result.etag);
      setSave({ kind: 'idle' });
    } catch {
      setSave({ kind: 'error', message: 'We could not reload your account.' });
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
    } catch {
      setSave({ kind: 'error', message: 'We could not switch workspace. Please try again.' });
    } finally {
      setSwitchingId(null);
    }
  }

  if (loadError) {
    return <Alert tone="danger">{loadError}</Alert>;
  }

  if (!profile) {
    return <ProfileSkeleton />;
  }

  const primaryGrant = profile.grants[0] ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader title="Personal information" />

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
              <p className="text-[14px] text-ink-muted">{getRoleLabel(primaryGrant.role)}</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            disabled={save.kind === 'saving'}
            hint="Shown to your team across assignments, actions and history."
          />

          <TextField
            label="Work email"
            value={profile.email}
            readOnly
            disabled
            hint="Your sign-in address is managed by your administrator."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Phone number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={40}
              inputMode="tel"
              autoComplete="tel"
              disabled={save.kind === 'saving'}
            />

            <SelectField
              label="Language"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              options={withCurrentValue(LOCALE_OPTIONS, locale)}
              disabled={save.kind === 'saving'}
            />
          </div>

          <SelectField
            label="Time zone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            options={withCurrentValue(TIMEZONE_OPTIONS, timezone)}
            disabled={save.kind === 'saving'}
          />

          {save.kind === 'conflict' ? (
            <Alert tone="warning" title="This profile changed somewhere else.">
              Reload it before applying your changes.
              <Button
                variant="secondary"
                size="md"
                className="mt-3"
                onClick={() => void reloadAfterConflict()}
              >
                Reload profile
              </Button>
            </Alert>
          ) : null}

          {save.kind === 'error' ? <Alert tone="danger">{save.message}</Alert> : null}

          {save.kind === 'saved' ? <Alert tone="success">Your changes were saved.</Alert> : null}

          <Button type="submit" fullWidth loading={save.kind === 'saving'} disabled={!dirty}>
            Save changes
          </Button>
        </form>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Current access" />

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
                  {primaryGrant ? getRoleLabel(primaryGrant.role) : 'No role assigned'}
                </p>

                {primaryGrant ? <Badge tone="success">Primary role</Badge> : null}
              </div>

              {primaryGrant ? (
                <p className="text-[14px] text-ink-muted">{getRoleSummary(primaryGrant.role)}</p>
              ) : null}
            </div>
          </div>

          <dl className="mt-5 divide-y divide-line-soft border-t border-line-soft pt-1">
            <FieldRow label="Workspace">{profile.tenantName}</FieldRow>

            {primaryGrant ? (
              <>
                <FieldRow label="Territory scope">{getScopeLabel(primaryGrant.scopeType)}</FieldRow>

                <FieldRow label="Permission summary">
                  {getRolePermissionSummary(primaryGrant.role) ?? '—'}
                </FieldRow>
              </>
            ) : null}

            {profile.grants.length > 1 ? (
              <FieldRow label="Additional grants">
                {profile.grants
                  .slice(1)
                  .map((grant) => getRoleLabel(grant.role))
                  .join(', ')}
              </FieldRow>
            ) : null}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Workspace memberships" />

          {memberships === null ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1].map((index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : memberships.length === 0 ? (
            <p className="text-[14px] text-ink-muted">You have no other active workspaces.</p>
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
                        {membership.roles.map(getRoleLabel).join(', ')}
                      </span>
                    ) : null}
                  </span>

                  {membership.current ? (
                    <Badge tone="success" dot>
                      Active
                    </Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      loading={switchingId === membership.membershipId}
                      disabled={switchingId !== null}
                      onClick={() => void handleSwitch(membership.membershipId)}
                    >
                      Open
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* GET /me/memberships filters to status = 'active', so invited and
              suspended memberships in the design cannot be listed yet. */}
          <p className="mt-4 text-[13px] text-ink-muted">
            Only active workspaces appear here. Pending invitations are accepted from the link in
            your email.
          </p>
        </Card>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your account…</span>

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
