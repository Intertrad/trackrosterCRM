'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { inviteMembership } from '@/lib/api/membership-client';
import { roleLabel, TENANT_ROLES } from '@/lib/api/role-types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites one person into the workspace.
 *
 * The API also exposes POST /users, which takes an email and a password. That
 * path is deliberately not offered: an administrator should never set another
 * person's password. An invitation issues a single-use token that the invitee
 * redeems with a password only they choose.
 */
export function InviteUserDrawer({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('prospector');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail('');
    setDisplayName('');
    setRole('prospector');
    setEmailError(null);
    setFormError(null);
    setNotice(null);
    /* One key per opened form: retrying a failed send must not create a
     * second invitation for the same person. */
    setIdempotencyKey(crypto.randomUUID());
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (busy) {
      return;
    }

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address');

      return;
    }

    setEmailError(null);
    setFormError(null);
    setBusy(true);

    try {
      await inviteMembership(
        {
          email: trimmed,
          role,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        },
        idempotencyKey ?? crypto.randomUUID(),
      );

      setNotice(`Invitation sent to ${trimmed}.`);
      setEmail('');
      setDisplayName('');
      setIdempotencyKey(crypto.randomUUID());
      onInvited();
    } catch (caught) {
      setFormError(describeInviteError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} title="Invite users" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);

            if (emailError) {
              setEmailError(null);
            }
          }}
          error={emailError}
          placeholder="name@company.com"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={320}
          disabled={busy}
          required
        />

        <TextField
          label="Display name (optional)"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How their name appears in TrackRoster"
          maxLength={120}
          disabled={busy}
        />

        <SelectField
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={busy}
          options={TENANT_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
        />

        <p className="-mt-2 text-[13px] text-ink-muted">{describeRole(role)}</p>

        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Alert tone="info" title="The invitee chooses their own password.">
          TrackRoster emails a single-use invitation link. You never see or set their credentials.
        </Alert>

        <Button type="submit" fullWidth loading={busy} disabled={email.trim().length === 0}>
          Send invitation
        </Button>
      </form>
    </Drawer>
  );
}

function describeRole(role: string): string {
  switch (role) {
    case 'tenant_admin':
      return 'Full administration of this workspace, including users, roles and imports.';
    case 'director':
      return 'Management across the organizations they are granted.';
    case 'manager':
      return 'Management of their assigned teams, assignments and approvals.';
    case 'prospector':
      return 'Field prospecting within their assigned team and work queue.';
    case 'auditor':
      return 'Read-only access within explicitly granted scopes.';
    default:
      return '';
  }
}

function describeInviteError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    return 'This person already has a membership in this workspace.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to invite people to this workspace.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not send this invitation. Please try again.';
}
