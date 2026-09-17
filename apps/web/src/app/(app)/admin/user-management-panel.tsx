'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createUser, listUsers, updateUserStatus } from '@/lib/api/admin-client';
import type { ManagedUser, ManagedUserStatus } from '@/lib/api/admin-types';

import styles from './user-management-panel.module.css';

interface UserManagementPanelProps {
  currentUserId: string;
  onUsersChanged?: () => void;
}

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

function getStatusLabel(status: ManagedUserStatus): string {
  switch (status) {
    case 'active':
      return 'Active';

    case 'suspended':
      return 'Suspended';

    case 'disabled':
      return 'Disabled';
  }
}

export function UserManagementPanel({ currentUserId, onUsersChanged }: UserManagementPanelProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [isCreating, setIsCreating] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  const [statusMutationId, setStatusMutationId] = useState<string | null>(null);

  const [mutationError, setMutationError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSequence = useRef(0);

  const sortedUsers = useMemo(() => {
    return [...users].sort((left, right) => {
      if (left.status !== right.status) {
        const statusPriority: Record<ManagedUserStatus, number> = {
          active: 0,
          suspended: 1,
          disabled: 2,
        };

        return statusPriority[left.status] - statusPriority[right.status];
      }

      return left.email.localeCompare(right.email);
    });
  }, [users]);

  const activeCount = useMemo(
    () => users.filter((user) => user.status === 'active').length,
    [users],
  );

  const suspendedCount = useMemo(
    () => users.filter((user) => user.status === 'suspended').length,
    [users],
  );

  const disabledCount = useMemo(
    () => users.filter((user) => user.status === 'disabled').length,
    [users],
  );

  const loadUserData = useCallback(async () => {
    const requestSequence = ++loadSequence.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await listUsers();

      if (requestSequence !== loadSequence.current) {
        return;
      }

      setUsers(result);
    } catch (error) {
      if (requestSequence !== loadSequence.current) {
        return;
      }

      setUsers([]);

      setLoadError(getErrorMessage(error, 'Users could not be loaded.'));
    } finally {
      if (requestSequence === loadSequence.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadUserData();

    return () => {
      loadSequence.current += 1;
    };
  }, [loadUserData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedEmail = email.trim();

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    if (!normalizedEmail) {
      setCreateError('Email address is required.');

      return;
    }

    if (!password) {
      setCreateError('Password is required.');

      return;
    }

    if (password.length < 12) {
      setCreateError('Password must contain at least 12 characters.');

      return;
    }

    setIsCreating(true);

    try {
      const user = await createUser({
        email: normalizedEmail,
        password,
      });

      setUsers((current) => [user, ...current.filter((item) => item.id !== user.id)]);

      /*
       * Notify the admin page so dependent
       * panels, especially Access Grants,
       * can refresh their server-backed user list.
       */
      onUsersChanged?.();

      setEmail('');
      setPassword('');

      setSuccessMessage(`${user.email} was created successfully.`);
    } catch (error) {
      setCreateError(getErrorMessage(error, 'User could not be created.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusChange(
    user: ManagedUser,
    nextStatus: ManagedUserStatus,
  ): Promise<void> {
    if (user.status === nextStatus) {
      return;
    }

    /*
     * This is only a UX guard.
     * The backend remains authoritative and
     * also rejects attempts to suspend or
     * disable the authenticated user.
     */
    if (user.id === currentUserId && nextStatus !== 'active') {
      setMutationError('You cannot suspend or disable your own account.');

      return;
    }

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    setStatusMutationId(user.id);

    try {
      const updatedUser = await updateUserStatus(user.id, {
        status: nextStatus,
      });

      setUsers((current) =>
        current.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
      );

      /*
       * Keep the Access Grant user selector
       * synchronized with status changes.
       */
      onUsersChanged?.();

      setSuccessMessage(
        `${updatedUser.email} is now ${getStatusLabel(updatedUser.status).toLowerCase()}.`,
      );
    } catch (error) {
      setMutationError(getErrorMessage(error, 'User status could not be updated.'));
    } finally {
      setStatusMutationId(null);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Account administration</p>

          <h2>User management</h2>

          <p>Create tenant users and manage their account status.</p>
        </div>

        {!isLoading && !loadError ? (
          <span className={styles.rowCount}>
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        ) : null}
      </div>

      <div className={styles.summaryGrid} aria-label="User summary">
        <article className={styles.summaryCard}>
          <span>Users</span>

          <strong>{users.length}</strong>
        </article>

        <article className={`${styles.summaryCard} ${styles.activeSummary}`}>
          <span>Active</span>

          <strong>{activeCount}</strong>
        </article>

        <article className={`${styles.summaryCard} ${styles.suspendedSummary}`}>
          <span>Suspended</span>

          <strong>{suspendedCount}</strong>
        </article>

        <article className={`${styles.summaryCard} ${styles.disabledSummary}`}>
          <span>Disabled</span>

          <strong>{disabledCount}</strong>
        </article>
      </div>

      {successMessage ? (
        <div className={styles.successNotice} role="status" aria-live="polite">
          <strong>Change saved</strong>

          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className={styles.createSection}>
        <div>
          <h3>Create a user</h3>

          <p>New accounts are created as active. Access roles are assigned separately.</p>
        </div>

        <form
          className={styles.createForm}
          onSubmit={(event) => {
            void handleCreate(event);
          }}
        >
          <div className={styles.formField}>
            <label htmlFor="admin-user-email">Email</label>

            <input
              id="admin-user-email"
              name="email"
              type="email"
              value={email}
              maxLength={320}
              autoComplete="off"
              placeholder="manager@example.com"
              disabled={isCreating}
              onChange={(event) => {
                setEmail(event.target.value);

                setCreateError(null);
              }}
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="admin-user-password">Temporary password</label>

            <input
              id="admin-user-password"
              name="password"
              type="password"
              value={password}
              minLength={12}
              maxLength={1024}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              disabled={isCreating}
              onChange={(event) => {
                setPassword(event.target.value);

                setCreateError(null);
              }}
            />

            <span className={styles.fieldHint}>
              Minimum 12 characters. The password is sent only when creating the account and is not
              displayed afterward.
            </span>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>

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

      {isLoading ? (
        <div className={styles.loadingState} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />

          <div>
            <strong>Loading users</strong>

            <span>Retrieving tenant accounts.</span>
          </div>
        </div>
      ) : loadError ? (
        <div className={styles.errorState} role="alert">
          <div>
            <strong>Users could not be loaded</strong>

            <span>{loadError}</span>
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
      ) : sortedUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            U
          </div>

          <strong>No users yet</strong>

          <span>Create the first user with the form above.</span>
        </div>
      ) : (
        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>User</th>

                <th>Status</th>

                <th>Created</th>

                <th>Last updated</th>

                <th>Change status</th>
              </tr>
            </thead>

            <tbody>
              {sortedUsers.map((user) => {
                const isSelf = user.id === currentUserId;

                const isUpdating = statusMutationId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userIdentity}>
                        <strong>{user.email}</strong>

                        {isSelf ? <span className={styles.youBadge}>You</span> : null}
                      </div>

                      <small>{user.id}</small>
                    </td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          user.status === 'active'
                            ? styles.statusActive
                            : user.status === 'suspended'
                              ? styles.statusSuspended
                              : styles.statusDisabled
                        }`}
                      >
                        {getStatusLabel(user.status)}
                      </span>
                    </td>

                    <td>{formatTimestamp(user.createdAt)}</td>

                    <td>{formatTimestamp(user.updatedAt)}</td>

                    <td>
                      <select
                        className={styles.statusSelect}
                        value={user.status}
                        disabled={isUpdating}
                        aria-label={`Status for ${user.email}`}
                        onChange={(event) => {
                          void handleStatusChange(user, event.target.value as ManagedUserStatus);
                        }}
                      >
                        <option value="active">Active</option>

                        <option value="suspended" disabled={isSelf}>
                          Suspended
                        </option>

                        <option value="disabled" disabled={isSelf}>
                          Disabled
                        </option>
                      </select>

                      {isUpdating ? <span className={styles.savingLabel}>Saving…</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
