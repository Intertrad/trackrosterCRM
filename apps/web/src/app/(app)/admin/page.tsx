'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TeamManagementPanel } from './team-management-panel';
import { UserManagementPanel } from './user-management-panel';
import { AccessGrantManagementPanel } from './access-grant-management-panel';

import {
  createOrganization,
  listOrganizations,
  updateOrganizationStatus,
} from '@/lib/api/admin-client';
import type { AdminOrganization, OrganizationStatus } from '@/lib/api/admin-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

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

function getNextStatus(status: OrganizationStatus): OrganizationStatus {
  return status === 'active' ? 'inactive' : 'active';
}

function getStatusActionLabel(status: OrganizationStatus): string {
  return status === 'active' ? 'Deactivate' : 'Activate';
}

export default function AdminPage() {
  const { activeWorkspace, refreshSession, sessionError, status, user } = useAuth();

  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [usersRevision, setUsersRevision] = useState(0);

  const [teamsRevision, setTeamsRevision] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');

  const [slug, setSlug] = useState('');

  const [isCreating, setIsCreating] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  const [statusMutationId, setStatusMutationId] = useState<string | null>(null);

  const [mutationError, setMutationError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /*
   * Every list request receives a monotonically
   * increasing sequence number.
   *
   * If the workspace changes, the component
   * unmounts, or a newer reload begins, an older
   * response is ignored.
   */
  const loadSequence = useRef(0);

  const canManage = status === 'authenticated' && activeWorkspace?.mode === 'admin';

  const adminContextKey =
    canManage && user && activeWorkspace
      ? [user.tenantId, user.userId, activeWorkspace.key].join(':')
      : null;

  const adminContextKeyRef = useRef<string | null>(adminContextKey);

  /*
   * Keep this synchronous with the latest render.
   * Async mutations compare against it before
   * committing any result to the screen.
   */
  adminContextKeyRef.current = adminContextKey;

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [organizations]);

  const activeCount = useMemo(
    () => organizations.filter((organization) => organization.status === 'active').length,
    [organizations],
  );

  const handleUsersChanged = useCallback(() => {
    setUsersRevision((current) => current + 1);
  }, []);

  const handleTeamsChanged = useCallback(() => {
    setTeamsRevision((current) => current + 1);
  }, []);
  const inactiveCount = organizations.length - activeCount;

  const loadOrganizationData = useCallback(async () => {
    const requestSequence = ++loadSequence.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await listOrganizations();

      if (requestSequence !== loadSequence.current) {
        return;
      }

      setOrganizations(result);
    } catch (error) {
      if (requestSequence !== loadSequence.current) {
        return;
      }

      setLoadError(getErrorMessage(error, 'Organizations could not be loaded.'));
    } finally {
      if (requestSequence === loadSequence.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    /*
     * A change of tenant, authenticated user,
     * workspace, or permission invalidates every
     * organization request and all local admin state.
     */
    loadSequence.current += 1;

    setOrganizations([]);
    setLoadError(null);
    setIsLoading(false);

    setName('');
    setSlug('');
    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    setIsCreating(false);
    setStatusMutationId(null);

    if (!adminContextKey) {
      return;
    }

    void loadOrganizationData();

    return () => {
      loadSequence.current += 1;
    };
  }, [adminContextKey, loadOrganizationData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const requestContext = adminContextKeyRef.current;

    if (!requestContext) {
      return;
    }

    const normalizedName = name.trim();

    const normalizedSlug = slug.trim();

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    if (!normalizedName) {
      setCreateError('Organization name is required.');

      return;
    }

    if (!normalizedSlug) {
      setCreateError('Organization slug is required.');

      return;
    }

    setIsCreating(true);

    try {
      const organization = await createOrganization({
        name: normalizedName,
        slug: normalizedSlug,
      });

      /*
       * Never let a mutation started under an older
       * tenant/user/workspace update the new context.
       */
      if (adminContextKeyRef.current !== requestContext) {
        return;
      }

      setOrganizations((current) => [
        organization,
        ...current.filter((item) => item.id !== organization.id),
      ]);

      setName('');
      setSlug('');

      setSuccessMessage(`${organization.name} was created successfully.`);
    } catch (error) {
      if (adminContextKeyRef.current !== requestContext) {
        return;
      }

      setCreateError(getErrorMessage(error, 'Organization could not be created.'));
    } finally {
      if (adminContextKeyRef.current === requestContext) {
        setIsCreating(false);
      }
    }
  }

  async function handleStatusChange(organization: AdminOrganization): Promise<void> {
    const nextStatus = getNextStatus(organization.status);
    const requestContext = adminContextKeyRef.current;

    if (!requestContext) {
      return;
    }

    setMutationError(null);
    setCreateError(null);
    setSuccessMessage(null);

    setStatusMutationId(organization.id);

    try {
      const updatedOrganization = await updateOrganizationStatus(organization.id, {
        status: nextStatus,
      });

      if (adminContextKeyRef.current !== requestContext) {
        return;
      }

      setOrganizations((current) =>
        current.map((item) => (item.id === updatedOrganization.id ? updatedOrganization : item)),
      );

      setSuccessMessage(`${updatedOrganization.name} is now ${updatedOrganization.status}.`);
    } catch (error) {
      if (adminContextKeyRef.current !== requestContext) {
        return;
      }

      setMutationError(
        getErrorMessage(
          error,
          `Could not ${getStatusActionLabel(organization.status).toLowerCase()} this organization.`,
        ),
      );
    } finally {
      if (adminContextKeyRef.current === requestContext) {
        setStatusMutationId(null);
      }
    }
  }

  if (status === 'loading') {
    return (
      <main className={styles.page}>
        <section className={styles.loadingCard} aria-live="polite">
          <div className={styles.loadingIndicator} aria-hidden="true" />

          <div>
            <p className={styles.eyebrow}>Administration</p>

            <h1>Loading administration</h1>

            <p>Restoring your TrackRoster workspace.</p>
          </div>
        </section>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard}>
          <p className={styles.eyebrow}>Administration</p>

          <h1>Session unavailable</h1>

          <p>{sessionError ?? 'TrackRoster could not restore your session.'}</p>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              void refreshSession();
            }}
          >
            Retry session
          </button>
        </section>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard}>
          <p className={styles.eyebrow}>Administration</p>

          <h1>Client Admin workspace required</h1>

          <p>
            Organization administration is available only while working in the Client Admin
            workspace.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Administration</p>

          <h1>Organization management</h1>

          <p className={styles.pageDescription}>
            Create organizations and control whether they are active in the current TrackRoster
            tenant.
          </p>
        </div>

        <div className={styles.headerBadge}>Client Admin</div>
      </header>

      <section className={styles.summaryGrid} aria-label="Organization summary">
        <article className={styles.summaryCard}>
          <span>Organizations</span>

          <strong>{organizations.length}</strong>
        </article>

        <article className={`${styles.summaryCard} ${styles.activeSummary}`}>
          <span>Active</span>

          <strong>{activeCount}</strong>
        </article>

        <article className={`${styles.summaryCard} ${styles.inactiveSummary}`}>
          <span>Inactive</span>

          <strong>{inactiveCount}</strong>
        </article>
      </section>

      {successMessage ? (
        <div className={styles.successNotice} role="status" aria-live="polite">
          <span className={styles.noticeIcon} aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>Change saved</strong>

            <span>{successMessage}</span>
          </div>
        </div>
      ) : null}

      <section className={styles.createCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelEyebrow}>New organization</p>

            <h2>Create an organization</h2>

            <p>Add a new organizational scope. New organizations are created as active.</p>
          </div>
        </div>

        <form
          className={styles.createForm}
          onSubmit={(event) => {
            void handleCreate(event);
          }}
        >
          <div className={styles.formField}>
            <label htmlFor="organization-name">Organization name</label>

            <input
              id="organization-name"
              name="name"
              type="text"
              value={name}
              maxLength={255}
              autoComplete="off"
              placeholder="France Sales"
              disabled={isCreating}
              onChange={(event) => {
                setName(event.target.value);

                setCreateError(null);
              }}
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="organization-slug">Slug</label>

            <input
              id="organization-slug"
              name="slug"
              type="text"
              value={slug}
              maxLength={100}
              autoComplete="off"
              placeholder="france-sales"
              disabled={isCreating}
              onChange={(event) => {
                setSlug(event.target.value);

                setCreateError(null);
              }}
            />

            <span className={styles.fieldHint}>
              Used as the organization&apos;s stable human-readable identifier.
            </span>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create organization'}
            </button>
          </div>
        </form>

        {createError ? (
          <div className={styles.inlineError} role="alert">
            {createError}
          </div>
        ) : null}
      </section>

      <section className={styles.tablePanel} aria-busy={isLoading}>
        <div className={styles.tableHeader}>
          <div>
            <p className={styles.panelEyebrow}>Tenant structure</p>

            <h2>Organizations</h2>

            <p>Active and inactive organizations within your authenticated tenant.</p>
          </div>

          {!isLoading && !loadError ? (
            <span className={styles.rowCount}>
              {organizations.length} {organizations.length === 1 ? 'organization' : 'organizations'}
            </span>
          ) : null}
        </div>

        {mutationError ? (
          <div className={styles.tableError} role="alert">
            {mutationError}
          </div>
        ) : null}

        {isLoading ? (
          <div className={styles.tableState} aria-live="polite">
            <div className={styles.loadingIndicator} aria-hidden="true" />

            <div>
              <strong>Loading organizations</strong>

              <span>Retrieving the latest tenant structure.</span>
            </div>
          </div>
        ) : loadError ? (
          <div className={styles.errorCard} role="alert">
            <div>
              <strong>Organizations could not be loaded</strong>

              <span>{loadError}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadOrganizationData();
              }}
            >
              Retry
            </button>
          </div>
        ) : sortedOrganizations.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} aria-hidden="true">
              O
            </div>

            <strong>No organizations yet</strong>

            <span>Create the first organization using the form above.</span>
          </div>
        ) : (
          <div className={styles.tableScroller}>
            <table>
              <thead>
                <tr>
                  <th>Organization</th>

                  <th>Slug</th>

                  <th>Status</th>

                  <th>Last updated</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {sortedOrganizations.map((organization) => {
                  const isUpdating = statusMutationId === organization.id;

                  return (
                    <tr key={organization.id}>
                      <td>
                        <strong className={styles.organizationName}>{organization.name}</strong>

                        <small>{organization.id}</small>
                      </td>

                      <td>
                        <code>{organization.slug}</code>
                      </td>

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            organization.status === 'active'
                              ? styles.statusActive
                              : styles.statusInactive
                          }`}
                        >
                          {organization.status}
                        </span>
                      </td>

                      <td>{formatTimestamp(organization.updatedAt)}</td>

                      <td>
                        <button
                          type="button"
                          className={
                            organization.status === 'active'
                              ? styles.deactivateButton
                              : styles.activateButton
                          }
                          disabled={isUpdating}
                          aria-label={`${getStatusActionLabel(
                            organization.status,
                          )} ${organization.name}`}
                          onClick={() => {
                            void handleStatusChange(organization);
                          }}
                        >
                          {isUpdating ? 'Saving…' : getStatusActionLabel(organization.status)}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <TeamManagementPanel
        key={`teams:${adminContextKey ?? 'unavailable'}`}
        organizations={sortedOrganizations}
        onTeamsChanged={handleTeamsChanged}
      />

      {user ? (
        <UserManagementPanel
          key={`users:${adminContextKey ?? 'unavailable'}`}
          currentUserId={user.userId}
          onUsersChanged={handleUsersChanged}
        />
      ) : null}

      {user ? (
        <AccessGrantManagementPanel
          key={`access:${adminContextKey ?? 'unavailable'}`}
          organizations={sortedOrganizations}
          currentUserId={user.userId}
          usersRevision={usersRevision}
          teamsRevision={teamsRevision}
        />
      ) : null}
    </main>
  );
}
