'use client';

import { type FormEvent, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { inviteMembership } from '@/lib/api/membership-client';
import { listOrganizations, type OrganizationSummary } from '@/lib/api/organization-client';
import { roleLabel, TENANT_ROLES } from '@/lib/api/role-types';
import { createTeam, listTeams } from '@/lib/api/team-client';
import type { Team } from '@/lib/api/team-types';

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
  const [organizationId, setOrganizationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamCreateBusy, setTeamCreateBusy] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);
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
    setOrganizationId('');
    setTeamId('');
    setOrganizations([]);
    setTeams([]);
    setEmailError(null);
    setFormError(null);
    setCreatingTeam(false);
    setTeamCreateBusy(false);
    setTeamName('');
    setTeamError(null);
    setNotice(null);
    /* One key per opened form: retrying a failed send must not create a
     * second invitation for the same person. */
    setIdempotencyKey(crypto.randomUUID());
  }, [open]);

  useEffect(() => {
    if (!open || !requiresOrganization(role)) return;

    const controller = new AbortController();
    setScopeLoading(true);
    void listOrganizations({ status: 'active', limit: 100 }, controller.signal)
      .then((page) => setOrganizations(page.items))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setFormError(describeInviteError(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setScopeLoading(false);
      });

    return () => controller.abort();
  }, [open, role]);

  useEffect(() => {
    if (!organizationId || !requiresTeam(role)) {
      setTeams([]);
      setTeamId('');
      return;
    }

    const controller = new AbortController();
    setScopeLoading(true);
    void listTeams({ organizationId, status: 'active', limit: 100 }, controller.signal)
      .then((page) => setTeams(page.items))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setFormError(describeInviteError(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setScopeLoading(false);
      });

    return () => controller.abort();
  }, [organizationId, role]);

  async function handleCreateTeam(): Promise<void> {
    const name = teamName.trim();

    if (!organizationId || !name || teamCreateBusy) return;

    setTeamError(null);
    setTeamCreateBusy(true);

    try {
      const team = await createTeam({
        organizationId,
        name,
        slug: slugify(name),
      });
      setTeams((current) => [...current, team]);
      setTeamId(team.id);
      setTeamName('');
      setFormError(null);
      setNotice(`Team “${team.name}” created. You can now send the invitation.`);
    } catch (caught) {
      setTeamError(describeInviteError(caught));
    } finally {
      setTeamCreateBusy(false);
    }
  }

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

    if (requiresOrganization(role) && !organizationId) {
      setFormError('Choose an organization for this role.');
      return;
    }
    if (requiresTeam(role) && !teamId) {
      setFormError('Choose a team for this role.');
      return;
    }

    setBusy(true);

    try {
      await inviteMembership(
        {
          email: trimmed,
          role,
          ...(organizationId ? { organizationId } : {}),
          ...(teamId ? { teamId } : {}),
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
          onChange={(event) => {
            const nextRole = event.target.value;
            setRole(nextRole);
            setFormError(null);
            if (!requiresOrganization(nextRole)) {
              setOrganizationId('');
              setTeamId('');
            } else if (!requiresTeam(nextRole)) {
              setTeamId('');
            }
          }}
          disabled={busy}
          options={TENANT_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
        />

        <p className="-mt-2 text-[13px] text-ink-muted">{describeRole(role)}</p>

        {requiresOrganization(role) ? (
          <SelectField
            label="Organization"
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setTeamId('');
              setFormError(null);
            }}
            disabled={busy || scopeLoading}
            required
            options={[
              {
                value: '',
                label: scopeLoading ? 'Loading organizations…' : 'Choose an organization',
              },
              ...organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            ]}
          />
        ) : null}

        {requiresTeam(role) ? (
          <div className="flex flex-col gap-3">
            <SelectField
              label="Team"
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                setFormError(null);
              }}
              disabled={busy || scopeLoading || !organizationId || teams.length === 0}
              required
              options={[
                {
                  value: '',
                  label: !organizationId
                    ? 'Choose an organization first'
                    : scopeLoading
                      ? 'Loading teams…'
                      : teams.length === 0
                        ? 'No teams yet'
                        : 'Choose a team',
                },
                ...teams.map((team) => ({ value: team.id, label: team.name })),
              ]}
            />

            {organizationId && !scopeLoading && teams.length === 0 ? (
              <div className="rounded-lg border border-brand-pale bg-brand-tint px-3 py-3">
                <p className="text-[13px] font-bold text-navy">
                  No team for this organization yet.
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  Create one here, then it will be selected for this invitation.
                </p>
                {creatingTeam ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <TextField
                      label="Team name"
                      value={teamName}
                      onChange={(event) => {
                        setTeamName(event.target.value);
                        setTeamError(null);
                      }}
                      placeholder="Paris prospecting"
                      maxLength={255}
                      disabled={busy}
                    />
                    {teamError ? <Alert tone="danger">{teamError}</Alert> : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="md"
                        onClick={() => {
                          setCreatingTeam(false);
                          setTeamName('');
                          setTeamError(null);
                        }}
                        variant="secondary"
                        disabled={busy}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        onClick={() => void handleCreateTeam()}
                        loading={teamCreateBusy}
                        disabled={!teamName.trim() || busy || teamCreateBusy}
                      >
                        Create team
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="md"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      setCreatingTeam(true);
                      setTeamError(null);
                    }}
                    disabled={busy}
                  >
                    Create team
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Alert tone="info" title="The invitee chooses their own password.">
          TrackRoster emails a single-use invitation link. You never see or set their credentials.
        </Alert>

        <Button
          type="submit"
          fullWidth
          loading={busy}
          disabled={
            email.trim().length === 0 ||
            scopeLoading ||
            (requiresOrganization(role) && !organizationId) ||
            (requiresTeam(role) && !teamId)
          }
        >
          Send invitation
        </Button>
      </form>
    </Drawer>
  );
}

function requiresOrganization(role: string): boolean {
  return role === 'director' || role === 'manager' || role === 'prospector';
}

function requiresTeam(role: string): boolean {
  return role === 'manager' || role === 'prospector';
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return slug || `team-${crypto.randomUUID().slice(0, 8)}`;
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
