'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createTeam, listTeams, updateTeamStatus } from '@/lib/api/admin-client';
import type { AdminOrganization, AdminTeam, TeamStatus } from '@/lib/api/admin-types';

import styles from './team-management-panel.module.css';

interface TeamManagementPanelProps {
  organizations: AdminOrganization[];
  onTeamsChanged?: () => void;
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

function getNextStatus(status: TeamStatus): TeamStatus {
  return status === 'active' ? 'inactive' : 'active';
}

function getStatusActionLabel(status: TeamStatus): string {
  return status === 'active' ? 'Deactivate' : 'Activate';
}

export function TeamManagementPanel({ organizations, onTeamsChanged }: TeamManagementPanelProps) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  const [teams, setTeams] = useState<AdminTeam[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');

  const [slug, setSlug] = useState('');

  const [isCreating, setIsCreating] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);

  const [statusMutationId, setStatusMutationId] = useState<string | null>(null);

  const [mutationError, setMutationError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSequence = useRef(0);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) ?? null,
    [organizations, selectedOrganizationId],
  );

  const sortedTeams = useMemo(() => {
    return [...teams].sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [teams]);

  const activeCount = useMemo(
    () => teams.filter((team) => team.status === 'active').length,
    [teams],
  );

  const inactiveCount = teams.length - activeCount;

  const loadTeamData = useCallback(async (organizationId: string) => {
    const requestSequence = ++loadSequence.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await listTeams(organizationId);

      if (requestSequence !== loadSequence.current) {
        return;
      }

      setTeams(result);
    } catch (error) {
      if (requestSequence !== loadSequence.current) {
        return;
      }

      setTeams([]);

      setLoadError(getErrorMessage(error, 'Teams could not be loaded.'));
    } finally {
      if (requestSequence === loadSequence.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /*
   * Preserve the current organization selection
   * while it still exists. Otherwise prefer the
   * first active organization.
   */
  useEffect(() => {
    if (organizations.length === 0) {
      loadSequence.current += 1;

      setSelectedOrganizationId(null);

      setTeams([]);
      setLoadError(null);
      setIsLoading(false);

      return;
    }

    const selectionStillExists =
      selectedOrganizationId !== null &&
      organizations.some((organization) => organization.id === selectedOrganizationId);

    if (selectionStillExists) {
      return;
    }

    const nextOrganization =
      organizations.find((organization) => organization.status === 'active') ?? organizations[0];

    if (!nextOrganization) {
      return;
    }

    setSelectedOrganizationId(nextOrganization.id);
  }, [organizations, selectedOrganizationId]);

  /*
   * A change in organization invalidates any
   * previous team request and loads the teams
   * belonging to the new organization.
   */
  useEffect(() => {
    if (!selectedOrganizationId) {
      return;
    }

    setName('');
    setSlug('');
    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    void loadTeamData(selectedOrganizationId);

    return () => {
      loadSequence.current += 1;
    };
  }, [selectedOrganizationId, loadTeamData]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!selectedOrganizationId) {
      return;
    }

    const normalizedName = name.trim();

    const normalizedSlug = slug.trim();

    setCreateError(null);
    setMutationError(null);
    setSuccessMessage(null);

    if (!normalizedName) {
      setCreateError('Team name is required.');

      return;
    }

    if (!normalizedSlug) {
      setCreateError('Team slug is required.');

      return;
    }

    setIsCreating(true);

    try {
      const team = await createTeam(selectedOrganizationId, {
        name: normalizedName,
        slug: normalizedSlug,
      });

      setTeams((current) => [team, ...current.filter((item) => item.id !== team.id)]);

      /*
       * Tell the parent admin page that team
       * data changed so dependent panels can
       * refresh their own server-backed copy.
       */
      onTeamsChanged?.();

      setName('');
      setSlug('');

      setSuccessMessage(`${team.name} was created successfully.`);
    } catch (error) {
      setCreateError(getErrorMessage(error, 'Team could not be created.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusChange(team: AdminTeam): Promise<void> {
    if (!selectedOrganizationId) {
      return;
    }

    const nextStatus = getNextStatus(team.status);

    setMutationError(null);
    setCreateError(null);
    setSuccessMessage(null);

    setStatusMutationId(team.id);

    try {
      const updatedTeam = await updateTeamStatus(selectedOrganizationId, team.id, {
        status: nextStatus,
      });

      setTeams((current) =>
        current.map((item) => (item.id === updatedTeam.id ? updatedTeam : item)),
      );

      /*
       * Synchronize other admin panels such as
       * Access Grants after a team lifecycle
       * change.
       */
      onTeamsChanged?.();

      setSuccessMessage(`${updatedTeam.name} is now ${updatedTeam.status}.`);
    } catch (error) {
      setMutationError(
        getErrorMessage(
          error,
          `Could not ${getStatusActionLabel(team.status).toLowerCase()} this team.`,
        ),
      );
    } finally {
      setStatusMutationId(null);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Team structure</p>

          <h2>Team management</h2>

          <p>Create teams and manage their lifecycle within an organization.</p>
        </div>

        {organizations.length > 0 ? (
          <div className={styles.organizationSelector}>
            <label htmlFor="team-organization">Organization</label>

            <select
              id="team-organization"
              value={selectedOrganizationId ?? ''}
              disabled={isCreating || statusMutationId !== null}
              onChange={(event) => {
                setSelectedOrganizationId(event.target.value);
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
      </div>

      {organizations.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            T
          </div>

          <strong>Create an organization first</strong>

          <span>
            Teams belong to an organization. Add an organization above before creating teams.
          </span>
        </div>
      ) : (
        <>
          <div className={styles.summaryGrid} aria-label="Team summary">
            <article className={styles.summaryCard}>
              <span>Teams</span>

              <strong>{teams.length}</strong>
            </article>

            <article className={`${styles.summaryCard} ${styles.activeSummary}`}>
              <span>Active</span>

              <strong>{activeCount}</strong>
            </article>

            <article className={`${styles.summaryCard} ${styles.inactiveSummary}`}>
              <span>Inactive</span>

              <strong>{inactiveCount}</strong>
            </article>
          </div>

          {selectedOrganization ? (
            <div className={styles.scopeNotice}>
              Managing teams for <strong>{selectedOrganization.name}</strong>
              <span
                className={`${styles.statusBadge} ${
                  selectedOrganization.status === 'active'
                    ? styles.statusActive
                    : styles.statusInactive
                }`}
              >
                {selectedOrganization.status}
              </span>
            </div>
          ) : null}

          {successMessage ? (
            <div className={styles.successNotice} role="status" aria-live="polite">
              <strong>Change saved</strong>

              <span>{successMessage}</span>
            </div>
          ) : null}

          <div className={styles.createSection}>
            <div>
              <h3>Create a team</h3>

              <p>New teams are created as active inside the selected organization.</p>
            </div>

            <form
              className={styles.createForm}
              onSubmit={(event) => {
                void handleCreate(event);
              }}
            >
              <div className={styles.formField}>
                <label htmlFor="team-name">Team name</label>

                <input
                  id="team-name"
                  type="text"
                  value={name}
                  maxLength={255}
                  autoComplete="off"
                  placeholder="Paris Prospecting"
                  disabled={isCreating}
                  onChange={(event) => {
                    setName(event.target.value);

                    setCreateError(null);
                  }}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="team-slug">Slug</label>

                <input
                  id="team-slug"
                  type="text"
                  value={slug}
                  maxLength={100}
                  autoComplete="off"
                  placeholder="paris-prospecting"
                  disabled={isCreating}
                  onChange={(event) => {
                    setSlug(event.target.value);

                    setCreateError(null);
                  }}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isCreating || !selectedOrganizationId}
                >
                  {isCreating ? 'Creating…' : 'Create team'}
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
                <strong>Loading teams</strong>

                <span>Retrieving the selected organization&apos;s teams.</span>
              </div>
            </div>
          ) : loadError ? (
            <div className={styles.errorState} role="alert">
              <div>
                <strong>Teams could not be loaded</strong>

                <span>{loadError}</span>
              </div>

              {selectedOrganizationId ? (
                <button
                  type="button"
                  onClick={() => {
                    void loadTeamData(selectedOrganizationId);
                  }}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden="true">
                T
              </div>

              <strong>No teams yet</strong>

              <span>Create the first team for this organization.</span>
            </div>
          ) : (
            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>

                    <th>Slug</th>

                    <th>Status</th>

                    <th>Last updated</th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedTeams.map((team) => {
                    const isUpdating = statusMutationId === team.id;

                    return (
                      <tr key={team.id}>
                        <td>
                          <strong className={styles.teamName}>{team.name}</strong>

                          <small>{team.id}</small>
                        </td>

                        <td>
                          <code>{team.slug}</code>
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              team.status === 'active' ? styles.statusActive : styles.statusInactive
                            }`}
                          >
                            {team.status}
                          </span>
                        </td>

                        <td>{formatTimestamp(team.updatedAt)}</td>

                        <td>
                          <button
                            type="button"
                            className={
                              team.status === 'active'
                                ? styles.deactivateButton
                                : styles.activateButton
                            }
                            disabled={isUpdating}
                            aria-label={`${getStatusActionLabel(team.status)} ${team.name}`}
                            onClick={() => {
                              void handleStatusChange(team);
                            }}
                          >
                            {isUpdating ? 'Saving…' : getStatusActionLabel(team.status)}
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
