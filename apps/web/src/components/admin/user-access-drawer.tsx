'use client';

import { useEffect, useState } from 'react';
import { Building2, Map, ShieldCheck, Users } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  getMembership,
  resendInvitation,
  setMembershipStatus,
  updateMembership,
} from '@/lib/api/membership-client';
import {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  membershipInitials,
  membershipName,
  type MembershipDetail,
  type MembershipGrant,
  type MembershipSummary,
} from '@/lib/api/membership-types';
import { roleLabel, TENANT_ROLES } from '@/lib/api/role-types';

type Mode = 'view' | 'role' | 'suspend' | 'reactivate';

/**
 * The access panel for one membership.
 *
 * Every write here is conditional (If-Match) and idempotent. The key is minted
 * once per attempt-series and retired only on success, so a retry after a
 * network failure cannot apply the same change twice.
 */
export function UserAccessDrawer({
  member,
  onClose,
  onChanged,
}: {
  member: MembershipSummary | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<MembershipDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [role, setRole] = useState<string>('prospector');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const membershipId = member?.id ?? null;

  useEffect(() => {
    setDetail(null);
    setEtag(null);
    setMode('view');
    setReason('');
    setReadError(null);
    setWriteError(null);
    setNotice(null);
    setIdempotencyKey(null);

    if (!membershipId) {
      return;
    }

    const controller = new AbortController();

    getMembership(membershipId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetail(result.resource);
        setEtag(result.etag);
        setRole(result.resource.scopes.structural?.[0]?.role ?? 'prospector');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setReadError('We could not load this person’s access.');
        }
      });

    return () => controller.abort();
  }, [membershipId]);

  if (!member) {
    return <Drawer open={false} title="User access" onClose={onClose} children={null} />;
  }

  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;

  /* Held across retries so a replayed request is recognised upstream. */
  function nextKey(): string {
    if (idempotencyKey) {
      return idempotencyKey;
    }

    const key = crypto.randomUUID();

    setIdempotencyKey(key);

    return key;
  }

  async function run(action: () => Promise<MembershipDetail>, success: string): Promise<void> {
    setBusy(true);
    setWriteError(null);

    try {
      const updated = await action();

      setDetail(updated);
      /* The response body is the new resource; its validator arrives on the
       * next read, so the stale one is dropped rather than reused. */
      setEtag(null);
      setIdempotencyKey(null);
      setMode('view');
      setReason('');
      setNotice(success);
      onChanged();
    } catch (caught) {
      setWriteError(describeWriteError(caught));
    } finally {
      setBusy(false);
    }
  }

  const grants = detail?.scopes.structural ?? [];

  return (
    <Drawer
      open
      title="User access"
      onClose={onClose}
      headerAccessory={<StatusBadge status={member.status} />}
      footer={
        detail && mode === 'view' ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setMode('role')}>
              Edit access
            </Button>

            {detail.status === 'suspended' ? (
              <Button onClick={() => setMode('reactivate')}>Reactivate</Button>
            ) : detail.status === 'active' ? (
              <Button variant="danger" onClick={() => setMode('suspend')}>
                Suspend user
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[16px] font-bold text-brand"
          >
            {membershipInitials(member)}
          </span>

          <span className="min-w-0">
            <span className="block truncate text-[17px] font-bold text-navy">
              {membershipName(member)}
            </span>

            <span className="block truncate text-[14px] text-ink-muted">{member.email}</span>
          </span>
        </div>

        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {readError ? <Alert tone="danger">{readError}</Alert> : null}

        {detail === null && !readError ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-11 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : null}

        {detail ? (
          <>
            <dl className="flex flex-col gap-3">
              <Row icon={<ShieldCheck className="size-4" />} label="Roles">
                <span className="flex flex-wrap gap-1.5">
                  {member.roles.length === 0 ? (
                    <span className="text-[14px] text-ink-muted">No role granted</span>
                  ) : (
                    member.roles.map((granted) => (
                      <Badge key={granted} tone="brand">
                        {roleLabel(granted)}
                      </Badge>
                    ))
                  )}
                </span>
              </Row>

              <Row icon={<Users className="size-4" />} label="Workload">
                <span className="text-[14px] text-ink">
                  {detail.activeAssignments} active assignment
                  {detail.activeAssignments === 1 ? '' : 's'}
                  {detail.capacity === null ? ' · no target set' : ` of ${detail.capacity}`}
                </span>
              </Row>

              <Row icon={<Building2 className="size-4" />} label="Joined">
                <span className="text-[14px] text-ink">
                  {formatDate(detail.activatedAt ?? detail.invitedAt)}
                </span>
              </Row>
            </dl>

            <section>
              <h3 className="text-[15px] font-bold text-navy">Grants</h3>

              {grants.length === 0 ? (
                <p className="mt-2 text-[14px] text-ink-muted">
                  This membership holds no structural grant.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {grants.map((grant) => (
                    <GrantRow key={grant.grantId} grant={grant} />
                  ))}
                </ul>
              )}
            </section>

            {mode !== 'view' ? (
              <section className="rounded-xl border border-line-soft bg-surface-muted p-4">
                <h3 className="text-[15px] font-bold text-navy">
                  {mode === 'role'
                    ? 'Change role'
                    : mode === 'suspend'
                      ? 'Suspend this user'
                      : 'Reactivate this user'}
                </h3>

                <div className="mt-3 flex flex-col gap-3">
                  {mode === 'role' ? (
                    <SelectField
                      label="Role"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      options={TENANT_ROLES.map((value) => ({
                        value,
                        label: roleLabel(value),
                      }))}
                    />
                  ) : null}

                  <TextField
                    label="Reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Recorded in the audit log"
                    maxLength={MAX_REASON_LENGTH}
                    required
                  />

                  <p className="-mt-1 text-[13px] text-ink-muted">
                    At least {MIN_REASON_LENGTH} characters. This is written to the audit log.
                  </p>

                  {writeError ? <Alert tone="danger">{writeError}</Alert> : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      loading={busy}
                      disabled={reasonTooShort}
                      variant={mode === 'suspend' ? 'danger' : 'primary'}
                      onClick={() => {
                        const key = nextKey();

                        if (mode === 'role') {
                          void run(
                            () =>
                              updateMembership(
                                member.id,
                                { role, reason: reason.trim() },
                                { etag, idempotencyKey: key },
                              ),
                            'Role updated.',
                          );

                          return;
                        }

                        void run(
                          () =>
                            setMembershipStatus(
                              member.id,
                              mode === 'suspend' ? 'suspend' : 'reactivate',
                              reason.trim(),
                              { etag, idempotencyKey: key },
                            ),
                          mode === 'suspend' ? 'User suspended.' : 'User reactivated.',
                        );
                      }}
                    >
                      {mode === 'role'
                        ? 'Save role'
                        : mode === 'suspend'
                          ? 'Suspend'
                          : 'Reactivate'}
                    </Button>

                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setMode('view');
                        setReason('');
                        setWriteError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            {detail.status === 'invited' && mode === 'view' ? (
              <Alert tone="info" title="This invitation has not been accepted.">
                <Button
                  variant="secondary"
                  className="mt-3"
                  loading={busy}
                  onClick={() => {
                    const key = nextKey();

                    setBusy(true);
                    setWriteError(null);

                    resendInvitation(member.id, key)
                      .then(() => {
                        setIdempotencyKey(null);
                        setNotice('Invitation resent.');
                      })
                      .catch((caught: unknown) => setWriteError(describeWriteError(caught)))
                      .finally(() => setBusy(false));
                  }}
                >
                  Resend invitation
                </Button>
              </Alert>
            ) : null}

            <Alert tone="info" title="Access changes are audited.">
              Every role and status change is written to the audit log with the reason you give.
            </Alert>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}

function GrantRow({ grant }: { grant: MembershipGrant }) {
  const scope =
    grant.scopeType === 'tenant'
      ? 'Entire workspace'
      : grant.scopeType === 'organization'
        ? 'One organization'
        : grant.scopeType === 'team'
          ? 'One team'
          : grant.scopeType;

  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line-soft px-3 py-2.5">
      <Map aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-navy">{roleLabel(grant.role)}</span>

        <span className="block text-[13px] text-ink-muted">{scope}</span>
      </span>

      <Badge tone="neutral">
        {grant.permissions.length} permission{grant.permissions.length === 1 ? '' : 's'}
      </Badge>
    </li>
  );
}

function StatusBadge({ status }: { status: MembershipSummary['status'] }) {
  if (status === 'active') {
    return (
      <Badge tone="success" dot>
        Active
      </Badge>
    );
  }

  if (status === 'suspended') {
    return (
      <Badge tone="danger" dot>
        Suspended
      </Badge>
    );
  }

  if (status === 'invited') {
    return (
      <Badge tone="warning" dot>
        Invited
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" dot>
      Departed
    </Badge>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      <dt className="flex min-w-28 items-center gap-2 text-[13px] font-semibold text-ink-muted">
        <span aria-hidden="true" className="text-ink-muted">
          {icon}
        </span>

        {label}
      </dt>

      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function describeWriteError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This membership changed elsewhere. Close and reopen the panel to see the current access before saving again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to change this membership.';
  }

  if (error.statusCode === 400) {
    /* The API rejects a change that would leave the tenant with no admin. */
    return error.messages.join(' ');
  }

  return 'We could not save this change. Please try again.';
}
