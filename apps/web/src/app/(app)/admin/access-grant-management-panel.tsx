'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createAccessGrant,
  listAccessGrants,
  listTeams,
  listUsers,
  revokeAccessGrant,
} from '@/lib/api/admin-client';
import type {
  AdminAccessGrant,
  AdminOrganization,
  AdminTeam,
  CreateAccessGrantInput,
  ManagedUser,
} from '@/lib/api/admin-types';
import type { AccessScope, UserRole } from '@/lib/api/auth-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './access-grant-management-panel.module.css';

interface AccessGrantManagementPanelProps {
  organizations: AdminOrganization[];
  currentUserId: string;
  usersRevision: number;
  teamsRevision: number;
}

const ROLES_BY_SCOPE = {
  tenant: ['client_admin', 'observer'],
  organization: ['director', 'observer'],
  team: ['manager', 'prospector', 'observer'],
} as const satisfies Record<AccessScope, readonly UserRole[]>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatRole(role: UserRole): string {
  switch (role) {
    case 'client_admin':
      return 'Client Admin';

    case 'director':
      return 'Director';

    case 'manager':
      return 'Manager';

    case 'prospector':
      return 'Prospector';

    case 'observer':
      return 'Observer';
  }
}

function formatScope(scope: AccessScope): string {
  switch (scope) {
    case 'tenant':
      return 'Tenant';

    case 'organization':
      return 'Organization';

    case 'team':
      return 'Team';
  }
}

function isTenantRole(role: UserRole): role is 'client_admin' | 'observer' {
  return role === 'client_admin' || role === 'observer';
}

function isOrganizationRole(role: UserRole): role is 'director' | 'observer' {
  return role === 'director' || role === 'observer';
}

function isTeamRole(role: UserRole): role is 'manager' | 'prospector' | 'observer' {
  return role === 'manager' || role === 'prospector' || role === 'observer';
}

function buildGrantInput(
  scopeType: AccessScope,
  role: UserRole,
  organizationId: string,
  teamId: string,
): CreateAccessGrantInput | null {
  if (scopeType === 'tenant') {
    if (!isTenantRole(role)) {
      return null;
    }

    return {
      role,
      scopeType: 'tenant',
    };
  }

  if (scopeType === 'organization') {
    if (!isOrganizationRole(role) || !organizationId) {
      return null;
    }

    return {
      role,
      scopeType: 'organization',
      organizationId,
    };
  }

  if (!isTeamRole(role) || !organizationId || !teamId) {
    return null;
  }

  return {
    role,
    scopeType: 'team',
    organizationId,
    teamId,
  };
}

export function AccessGrantManagementPanel({
  organizations,
  currentUserId,
  usersRevision,
  teamsRevision,
}: AccessGrantManagementPanelProps) {
  const { refreshSession } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [usersLoading, setUsersLoading] = useState(false);

  const [usersError, setUsersError] = useState<string | null>(null);

  const [grants, setGrants] = useState<AdminAccessGrant[]>([]);

  const [grantsLoading, setGrantsLoading] = useState(false);

  const [grantsError, setGrantsError] = useState<string | null>(null);

  const [scopeType, setScopeType] = useState<AccessScope>('tenant');

  const [role, setRole] = useState<UserRole>('client_admin');

  const [organizationId, setOrganizationId] = useState('');

  const [teamId, setTeamId] = useState('');

  const [teams, setTeams] = useState<AdminTeam[]>([]);

  const [teamsLoading, setTeamsLoading] = useState(false);

  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);

  const [mutationError, setMutationError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const usersSequence = useRef(0);

  const grantsSequence = useRef(0);

  const teamsSequence = useRef(0);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.email.localeCompare(right.email)),
    [users],
  );

  const sortedGrants = useMemo(
    () =>
      [...grants].sort((left, right) => {
        if (left.scopeType !== right.scopeType) {
          const priority: Record<AccessScope, number> = {
            tenant: 0,
            organization: 1,
            team: 2,
          };

          return priority[left.scopeType] - priority[right.scopeType];
        }

        return left.role.localeCompare(right.role);
      }),
    [grants],
  );

  const organizationMap = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations],
  );

  const availableRoles = ROLES_BY_SCOPE[scopeType];

  const loadUserData = useCallback(async () => {
    const requestSequence = ++usersSequence.current;

    setUsersLoading(true);
    setUsersError(null);

    try {
      const result = await listUsers();

      if (requestSequence !== usersSequence.current) {
        return;
      }

      setUsers(result);
    } catch (error) {
      if (requestSequence !== usersSequence.current) {
        return;
      }

      setUsers([]);

      setUsersError(getErrorMessage(error, 'Users could not be loaded.'));
    } finally {
      if (requestSequence === usersSequence.current) {
        setUsersLoading(false);
      }
    }
  }, []);

  const loadGrantData = useCallback(async (userId: string) => {
    const requestSequence = ++grantsSequence.current;

    setGrantsLoading(true);
    setGrantsError(null);

    try {
      const result = await listAccessGrants(userId);

      if (requestSequence !== grantsSequence.current) {
        return;
      }

      setGrants(result);
    } catch (error) {
      if (requestSequence !== grantsSequence.current) {
        return;
      }

      setGrants([]);

      setGrantsError(getErrorMessage(error, 'Access grants could not be loaded.'));
    } finally {
      if (requestSequence === grantsSequence.current) {
        setGrantsLoading(false);
      }
    }
  }, []);

  const loadTeamData = useCallback(async (targetOrganizationId: string) => {
    const requestSequence = ++teamsSequence.current;

    setTeamsLoading(true);
    setTeamsError(null);
    setTeams([]);
    setTeamId('');

    try {
      const result = await listTeams(targetOrganizationId);

      if (requestSequence !== teamsSequence.current) {
        return;
      }

      setTeams(result);

      const preferredTeam = result.find((team) => team.status === 'active') ?? result[0];

      setTeamId(preferredTeam?.id ?? '');
    } catch (error) {
      if (requestSequence !== teamsSequence.current) {
        return;
      }

      setTeams([]);

      setTeamsError(getErrorMessage(error, 'Teams could not be loaded.'));
    } finally {
      if (requestSequence === teamsSequence.current) {
        setTeamsLoading(false);
      }
    }
  }, []);

  /*
   * Reload the Access Grant panel's user copy
   * whenever User Management reports a change.
   *
   * Request sequence protection ensures an older
   * request can never replace newer user data.
   */
  useEffect(() => {
    void loadUserData();

    return () => {
      usersSequence.current += 1;
      grantsSequence.current += 1;
      teamsSequence.current += 1;
    };
  }, [loadUserData, usersRevision]);

  /*
   * Keep a valid selected user after the user list
   * changes. Prefer the authenticated admin, then
   * another active user, then any remaining user.
   */
  useEffect(() => {
    if (users.length === 0) {
      grantsSequence.current += 1;

      setSelectedUserId(null);

      setGrants([]);
      setGrantsError(null);
      setGrantsLoading(false);

      return;
    }

    const selectionExists =
      selectedUserId !== null && users.some((user) => user.id === selectedUserId);

    if (selectionExists) {
      return;
    }

    const preferredUser =
      users.find((user) => user.id === currentUserId) ??
      users.find((user) => user.status === 'active') ??
      users[0];

    if (!preferredUser) {
      return;
    }

    setSelectedUserId(preferredUser.id);
  }, [users, selectedUserId, currentUserId]);

  /*
   * A user selection change invalidates the
   * previous grant request and loads only that
   * user's current grants.
   */
  useEffect(() => {
    if (!selectedUserId) {
      grantsSequence.current += 1;

      setGrants([]);
      setGrantsError(null);
      setGrantsLoading(false);

      return;
    }

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    void loadGrantData(selectedUserId);

    return () => {
      grantsSequence.current += 1;
    };
  }, [selectedUserId, loadGrantData]);

  /*
   * Keep organization selection valid as the
   * organization list changes.
   */
  useEffect(() => {
    if (scopeType === 'tenant') {
      teamsSequence.current += 1;

      setOrganizationId('');
      setTeamId('');
      setTeams([]);
      setTeamsError(null);
      setTeamsLoading(false);

      return;
    }

    const selectionExists = organizations.some(
      (organization) => organization.id === organizationId,
    );

    if (selectionExists) {
      return;
    }

    const preferredOrganization =
      organizations.find((organization) => organization.status === 'active') ?? organizations[0];

    setOrganizationId(preferredOrganization?.id ?? '');
  }, [scopeType, organizations, organizationId]);

  /*
   * Reload team choices after Team Management
   * creates a team or changes a team status.
   */
  useEffect(() => {
    if (scopeType !== 'team' || !organizationId) {
      teamsSequence.current += 1;

      setTeams([]);
      setTeamId('');
      setTeamsError(null);
      setTeamsLoading(false);

      return;
    }

    void loadTeamData(organizationId);

    return () => {
      teamsSequence.current += 1;
    };
  }, [scopeType, organizationId, loadTeamData, teamsRevision]);

  function handleScopeChange(nextScope: AccessScope): void {
    setScopeType(nextScope);

    setRole(ROLES_BY_SCOPE[nextScope][0]);

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedUserId) {
      return;
    }

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    const input = buildGrantInput(scopeType, role, organizationId, teamId);

    if (!input) {
      setCreateError('Select a valid role and scope before creating the grant.');

      return;
    }

    setIsCreating(true);

    try {
      const grant = await createAccessGrant(selectedUserId, input);

      setGrants((current) => [grant, ...current.filter((item) => item.id !== grant.id)]);

      setSuccessMessage(`${formatRole(grant.role)} access was granted successfully.`);

      /*
       * If the administrator changes their own
       * grants, immediately refresh the auth
       * context. The parent admin-context key will
       * then remove this page if Client Admin
       * access is no longer available.
       */
      if (selectedUserId === currentUserId) {
        await refreshSession();
      }
    } catch (error) {
      setCreateError(getErrorMessage(error, 'Access grant could not be created.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(grant: AdminAccessGrant): Promise<void> {
    if (!selectedUserId) {
      return;
    }

    const confirmed = window.confirm(
      [
        `Revoke ${formatRole(grant.role)} access?`,
        '',
        `Scope: ${formatScope(grant.scopeType)}`,
        '',
        'This change takes effect immediately and may remove resources from the affected user.',
      ].join('\n'),
    );

    if (!confirmed) {
      return;
    }

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    setRevokingGrantId(grant.id);

    try {
      await revokeAccessGrant(selectedUserId, grant.id);

      setGrants((current) => current.filter((item) => item.id !== grant.id));

      setSuccessMessage(`${formatRole(grant.role)} access was revoked.`);

      if (selectedUserId === currentUserId) {
        await refreshSession();
      }
    } catch (error) {
      setMutationError(getErrorMessage(error, 'Access grant could not be revoked.'));
    } finally {
      setRevokingGrantId(null);
    }
  }

  function renderScopeDetails(grant: AdminAccessGrant): string {
    if (grant.scopeType === 'tenant') {
      return 'Entire tenant';
    }

    const organization = grant.organizationId ? organizationMap.get(grant.organizationId) : null;

    if (grant.scopeType === 'organization') {
      return organization?.name ?? grant.organizationId ?? 'Unknown organization';
    }

    const organizationName = organization?.name ?? grant.organizationId ?? 'Unknown organization';

    return `${organizationName} / Team ${grant.teamId ?? 'unknown'}`;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Authorization</p>

          <h2>Access grants</h2>

          <p>Assign tenant, organization, and team permissions to users.</p>
        </div>

        {!usersLoading && !usersError ? (
          <span className={styles.rowCount}>
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        ) : null}
      </div>

      {usersLoading ? (
        <div className={styles.loadingState} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />

          <div>
            <strong>Loading users</strong>

            <span>Retrieving users available for access management.</span>
          </div>
        </div>
      ) : usersError ? (
        <div className={styles.errorState} role="alert">
          <div>
            <strong>Users could not be loaded</strong>

            <span>{usersError}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadUserData();
            }}
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            A
          </div>

          <strong>No users available</strong>

          <span>Create a user before assigning access.</span>
        </div>
      ) : (
        <>
          <div className={styles.userSelector}>
            <label htmlFor="access-user">Manage access for</label>

            <select
              id="access-user"
              value={selectedUserId ?? ''}
              disabled={isCreating || revokingGrantId !== null}
              onChange={(event) => {
                setSelectedUserId(event.target.value);
              }}
            >
              {sortedUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}

                  {user.id === currentUserId ? ' (You)' : ''}

                  {' — '}

                  {user.status}
                </option>
              ))}
            </select>

            {selectedUser ? (
              <div className={styles.selectedUserDetails}>
                <strong>{selectedUser.email}</strong>

                <span>{selectedUser.status}</span>

                {selectedUser.id === currentUserId ? (
                  <span className={styles.youBadge}>You</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {successMessage ? (
            <div className={styles.successNotice} role="status" aria-live="polite">
              <strong>Change saved</strong>

              <span>{successMessage}</span>
            </div>
          ) : null}

          <div className={styles.createSection}>
            <div>
              <h3>Create access grant</h3>

              <p>Role options change automatically based on the selected scope.</p>
            </div>

            <form
              className={styles.createForm}
              onSubmit={(event) => {
                void handleCreate(event);
              }}
            >
              <div className={styles.formField}>
                <label htmlFor="grant-scope">Scope</label>

                <select
                  id="grant-scope"
                  value={scopeType}
                  disabled={isCreating}
                  onChange={(event) => {
                    handleScopeChange(event.target.value as AccessScope);
                  }}
                >
                  <option value="tenant">Tenant</option>

                  <option value="organization" disabled={organizations.length === 0}>
                    Organization
                  </option>

                  <option value="team" disabled={organizations.length === 0}>
                    Team
                  </option>
                </select>
              </div>

              <div className={styles.formField}>
                <label htmlFor="grant-role">Role</label>

                <select
                  id="grant-role"
                  value={role}
                  disabled={isCreating}
                  onChange={(event) => {
                    setRole(event.target.value as UserRole);

                    setCreateError(null);
                  }}
                >
                  {availableRoles.map((availableRole) => (
                    <option key={availableRole} value={availableRole}>
                      {formatRole(availableRole)}
                    </option>
                  ))}
                </select>
              </div>

              {scopeType !== 'tenant' ? (
                <div className={styles.formField}>
                  <label htmlFor="grant-organization">Organization</label>

                  <select
                    id="grant-organization"
                    value={organizationId}
                    disabled={isCreating}
                    onChange={(event) => {
                      setOrganizationId(event.target.value);

                      setCreateError(null);
                    }}
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name} ({organization.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {scopeType === 'team' ? (
                <div className={styles.formField}>
                  <label htmlFor="grant-team">Team</label>

                  <select
                    id="grant-team"
                    value={teamId}
                    disabled={isCreating || teamsLoading || !organizationId}
                    onChange={(event) => {
                      setTeamId(event.target.value);

                      setCreateError(null);
                    }}
                  >
                    {teams.length === 0 ? (
                      <option value="">
                        {teamsLoading ? 'Loading teams…' : 'No teams available'}
                      </option>
                    ) : (
                      teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.status})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : null}

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    isCreating ||
                    grantsLoading ||
                    revokingGrantId !== null ||
                    !selectedUserId ||
                    (scopeType !== 'tenant' && !organizationId) ||
                    (scopeType === 'team' && (teamsLoading || !teamId))
                  }
                >
                  {isCreating ? 'Granting…' : 'Grant access'}
                </button>
              </div>
            </form>

            {teamsError && scopeType === 'team' ? (
              <div className={styles.inlineError} role="alert">
                {teamsError}
              </div>
            ) : null}

            {createError ? (
              <div className={styles.inlineError} role="alert">
                {createError}
              </div>
            ) : null}
          </div>

          {mutationError ? (
            <div className={styles.inlineError} role="alert">
              {mutationError}
            </div>
          ) : null}

          <div className={styles.grantHeader}>
            <div>
              <h3>Existing grants</h3>

              <p>
                Current access for <strong>{selectedUser?.email}</strong>.
              </p>
            </div>

            {!grantsLoading && !grantsError ? (
              <span className={styles.rowCount}>
                {grants.length} {grants.length === 1 ? 'grant' : 'grants'}
              </span>
            ) : null}
          </div>

          {grantsLoading ? (
            <div className={styles.loadingState} aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />

              <div>
                <strong>Loading access</strong>

                <span>Retrieving the selected user&apos;s grants.</span>
              </div>
            </div>
          ) : grantsError ? (
            <div className={styles.errorState} role="alert">
              <div>
                <strong>Grants could not be loaded</strong>

                <span>{grantsError}</span>
              </div>

              {selectedUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    void loadGrantData(selectedUserId);
                  }}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : sortedGrants.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden="true">
                A
              </div>

              <strong>No access grants</strong>

              <span>Assign the first role using the form above.</span>
            </div>
          ) : (
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Role</th>

                    <th>Scope</th>

                    <th>Scope details</th>

                    <th>Created</th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedGrants.map((grant) => {
                    const isRevoking = revokingGrantId === grant.id;

                    return (
                      <tr key={grant.id}>
                        <td>
                          <span className={styles.roleBadge}>{formatRole(grant.role)}</span>
                        </td>

                        <td>
                          <span className={styles.scopeBadge}>{formatScope(grant.scopeType)}</span>
                        </td>

                        <td>
                          <strong className={styles.scopeDetails}>
                            {renderScopeDetails(grant)}
                          </strong>

                          {grant.organizationId ? <small>Org: {grant.organizationId}</small> : null}

                          {grant.teamId ? <small>Team: {grant.teamId}</small> : null}
                        </td>

                        <td>{formatTimestamp(grant.createdAt)}</td>

                        <td>
                          <button
                            type="button"
                            className={styles.revokeButton}
                            disabled={revokingGrantId !== null}
                            aria-label={`Revoke ${formatRole(grant.role)} access`}
                            onClick={() => {
                              void handleRevoke(grant);
                            }}
                          >
                            {isRevoking ? 'Revoking…' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
