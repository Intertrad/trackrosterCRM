'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, CirclePause, CirclePlay, List, Repeat } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  completeAssignment,
  listAssignments,
  reassignAssignment,
  revokeAssignment,
  updateAssignment,
} from '@/lib/api/assignment-lifecycle-client';
import {
  ASSIGNMENT_PRIORITIES,
  MAX_ASSIGNMENT_REASON,
  MIN_ASSIGNMENT_REASON,
  isAssignmentOpen,
  priorityTone,
  statusTone,
  type Assignment,
  type AssignmentPriority,
  type AssignmentStatus,
} from '@/lib/api/assignment-lifecycle-types';
import { listScopedMemberships as listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { useAuth } from '@/lib/auth/auth-context';

type Action = 'reassign' | 'complete' | 'revoke';

export default function ActiveAssignmentsPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? undefined;

  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [summaryAssignments, setSummaryAssignments] = useState<Assignment[] | null>(null);
  const [status, setStatus] = useState<AssignmentStatus | 'all'>('active');
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());

  const [readError, setReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ assignment: Assignment; action: Action } | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> => {
      const pageRequest = listAssignments(
        { teamId, limit: 100, ...(status === 'all' ? {} : { status }) },
        signal,
      );
      const summaryRequest =
        status === 'all' ? pageRequest : listAssignments({ teamId, limit: 100 }, signal);

      return Promise.all([pageRequest, summaryRequest])
        .then(([page, summary]) => {
          if (!signal?.aborted) {
            setAssignments(page.items);
            setSummaryAssignments(summary.items);
            setReadError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            /* Keep the last good page visible during a transient refresh failure. */
            setAssignments((current) => current ?? []);
            setSummaryAssignments((current) => current ?? []);
            setReadError(
              describeAssignmentError(
                caught,
                'We could not refresh assignments. Check the API connection and try again.',
              ),
            );
          }
        });
    },
    [status, teamId],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /* Member names are read only from the authorized management roster. */
  useEffect(() => {
    const controller = new AbortController();

    listMemberships({ teamId, limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((item) => [item.id, item]))))
      .catch(() => setPeople(new Map()));

    return () => controller.abort();
  }, [teamId]);

  const counts = useMemo(() => {
    const all = summaryAssignments ?? assignments ?? [];
    const shown = assignments ?? [];

    return {
      total: shown.length,
      active: all.filter((item) => item.status === 'active').length,
      paused: all.filter((item) => item.status === 'paused').length,
      completed: all.filter((item) => item.status === 'completed').length,
      unowned: all.filter((item) => item.assignedUserId === null && isAssignmentOpen(item)).length,
    };
  }, [assignments, summaryAssignments]);

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key);
    setActionError(null);
    setNotice(null);

    try {
      await operation();
      await load();
      setNotice(success);
      setSelected(null);
    } catch (caught) {
      setActionError(
        describeAssignmentError(caught, 'The assignment action could not be completed. Try again.'),
      );
    } finally {
      setBusy(null);
    }
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Active assignments" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to manage its assignments.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-ink-muted">
          <Link href="/manager/assignments" className="font-semibold text-brand hover:underline">
            Assignments
          </Link>{' '}
          / Active
        </nav>

        <PageHeader
          title="Active assignments"
          subtitle="Reassign, pause, complete or revoke individual assignments"
        />
      </div>

      {readError ? (
        <Alert tone="danger">
          <div className="flex flex-wrap items-center gap-3">
            <span>{readError}</span>
            <Button variant="secondary" onClick={() => void load()} disabled={busy !== null}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          icon={<CirclePlay aria-hidden="true" className="size-5" />}
          tone="success"
          value={assignments === null ? null : counts.active}
          label="Active"
        />

        <StatTile
          icon={<CirclePause aria-hidden="true" className="size-5" />}
          tone={counts.paused > 0 ? 'warning' : 'neutral'}
          value={assignments === null ? null : counts.paused}
          label="Paused"
        />

        <StatTile
          icon={<Repeat aria-hidden="true" className="size-5" />}
          tone={counts.unowned > 0 ? 'warning' : 'neutral'}
          value={assignments === null ? null : counts.unowned}
          label="Team-owned"
          delta="Assigned to the team, nobody yet"
        />

        <StatTile
          icon={<CircleCheck aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={summaryAssignments === null ? null : counts.completed}
          label="Completed"
        />

        <StatTile
          icon={<List aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={assignments === null ? null : counts.total}
          label="Shown"
        />
      </div>

      <Card>
        <CardHeader
          title="Assignments"
          action={
            <FilterSelect
              label="Status"
              value={status}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'completed', label: 'Completed' },
                { value: 'revoked', label: 'Revoked' },
                { value: 'all', label: 'All' },
              ]}
              onChange={(value) => setStatus(value as AssignmentStatus | 'all')}
            />
          }
        />

        {assignments === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-muted">
            No {status === 'all' ? '' : status} assignments for this team.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {assignments.map((assignment) => {
              const owner = assignment.assignedUserId
                ? people.get(assignment.assignedUserId)
                : undefined;
              const open = isAssignmentOpen(assignment);

              return (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {assignment.prospectName ??
                        `Prospect ${assignment.campaignProspectId.slice(0, 8)}`}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {owner
                        ? membershipName(owner)
                        : assignment.assignedUserId
                          ? 'Assigned member'
                          : 'Team-owned'}{' '}
                      · assigned {formatDate(assignment.assignedAt)}
                      {assignment.endReason ? ` · ${assignment.endReason}` : ''}
                    </span>
                  </span>

                  <Badge tone={priorityTone(assignment.priority)}>{assignment.priority}</Badge>

                  <Badge tone={statusTone(assignment.status)} dot>
                    {assignment.status}
                  </Badge>

                  {open ? (
                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        loading={busy === `toggle-${assignment.id}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `toggle-${assignment.id}`,
                            () =>
                              updateAssignment(
                                assignment.id,
                                {
                                  status: assignment.status === 'paused' ? 'active' : 'paused',
                                },
                                {
                                  etag: assignment.etag,
                                  idempotencyKey: crypto.randomUUID(),
                                },
                              ),
                            assignment.status === 'paused'
                              ? 'Assignment resumed.'
                              : 'Assignment paused.',
                          )
                        }
                      >
                        {assignment.status === 'paused' ? 'Resume' : 'Pause'}
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => setSelected({ assignment, action: 'reassign' })}
                      >
                        Reassign
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => setSelected({ assignment, action: 'complete' })}
                      >
                        Complete
                      </Button>

                      <Button
                        variant="danger"
                        disabled={busy !== null}
                        onClick={() => setSelected({ assignment, action: 'revoke' })}
                      >
                        Revoke
                      </Button>
                    </span>
                  ) : (
                    <Badge tone="neutral">Closed {formatDate(assignment.endedAt)}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Alert tone="info" className="mt-5" title="Priority and pause are reversible.">
          Complete and revoke both end the assignment permanently and require a reason, which is
          written to the audit log.
        </Alert>
      </Card>

      <ActionDrawer
        selection={selected}
        people={[...people.values()]}
        teamId={teamId}
        busy={busy !== null}
        onClose={() => setSelected(null)}
        onSubmit={(assignment, action, reason, target) => {
          const options = { etag: assignment.etag, idempotencyKey: crypto.randomUUID() };

          if (action === 'reassign') {
            return run(
              `reassign-${assignment.id}`,
              () =>
                reassignAssignment(
                  assignment.id,
                  { teamId: target.teamId, assignedUserId: target.assignedUserId, reason },
                  options,
                ),
              'Assignment moved.',
            );
          }

          if (action === 'complete') {
            return run(
              `complete-${assignment.id}`,
              () => completeAssignment(assignment.id, reason, options),
              'Assignment completed.',
            );
          }

          return run(
            `revoke-${assignment.id}`,
            () => revokeAssignment(assignment.id, reason, options),
            'Assignment revoked.',
          );
        }}
      />
    </div>
  );
}

function ActionDrawer({
  selection,
  people,
  teamId,
  busy,
  onClose,
  onSubmit,
}: {
  selection: { assignment: Assignment; action: Action } | null;
  people: MembershipSummary[];
  teamId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    assignment: Assignment,
    action: Action,
    reason: string,
    target: { teamId: string; assignedUserId: string | null },
  ) => void;
}) {
  const [reason, setReason] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [priority, setPriority] = useState<AssignmentPriority>('normal');

  useEffect(() => {
    setReason('');
    setAssignedUserId(selection?.assignment.assignedUserId ?? '');
    setPriority(selection?.assignment.priority ?? 'normal');
  }, [selection]);

  if (!selection) {
    return <Drawer open={false} title="Assignment" onClose={onClose} children={null} />;
  }

  const { assignment, action } = selection;
  const selectedUserId = assignedUserId === '' ? null : assignedUserId;
  const unchangedTarget = action === 'reassign' && assignment.assignedUserId === selectedUserId;

  const title =
    action === 'reassign'
      ? 'Reassign'
      : action === 'complete'
        ? 'Complete assignment'
        : 'Revoke assignment';

  return (
    <Drawer open title={title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {action === 'revoke' ? (
          <Alert tone="warning" title="Revoking returns the prospect to the pool.">
            It ends this assignment without a completed outcome.
          </Alert>
        ) : null}

        {action === 'reassign' ? (
          <>
            <SelectField
              label="Assign to"
              value={assignedUserId}
              disabled={busy}
              onChange={(event) => setAssignedUserId(event.target.value)}
              options={[
                { value: '', label: 'Leave with the team (nobody)' },
                ...people.map((person) => ({
                  value: person.id,
                  label: membershipName(person),
                })),
              ]}
            />

            <p className="-mt-2 text-[13px] text-ink-muted">
              {unchangedTarget
                ? 'Choose a different owner or leave it with the team before submitting.'
                : 'Leaving nobody assigned keeps the prospect owned by the team so anyone on it can pick the work up.'}
            </p>
          </>
        ) : null}

        {action !== 'reassign' ? (
          <SelectField
            label="Priority (unchanged by this action)"
            value={priority}
            disabled
            onChange={() => undefined}
            options={ASSIGNMENT_PRIORITIES.map((value) => ({ value, label: value }))}
          />
        ) : null}

        <TextField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Recorded in the audit log"
          maxLength={MAX_ASSIGNMENT_REASON}
          disabled={busy}
          required
        />

        <p className="-mt-3 text-[13px] text-ink-muted">
          At least {MIN_ASSIGNMENT_REASON} characters.
        </p>

        <Button
          fullWidth
          loading={busy}
          variant={action === 'revoke' ? 'danger' : 'primary'}
          disabled={reason.trim().length < MIN_ASSIGNMENT_REASON || unchangedTarget}
          onClick={() =>
            onSubmit(assignment, action, reason.trim(), {
              teamId,
              assignedUserId: assignedUserId === '' ? null : assignedUserId,
            })
          }
        >
          {title}
        </Button>
      </div>
    </Drawer>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function describeAssignmentError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This assignment changed elsewhere. Reload before trying again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to change this assignment.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  if (error.statusCode === 401) {
    return 'Your session expired. Sign in again and retry.';
  }

  if (error.statusCode === 404) {
    return 'This assignment is no longer available. Refresh the list and try again.';
  }

  return fallback;
}
