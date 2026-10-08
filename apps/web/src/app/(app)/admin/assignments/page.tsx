'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw, UserRound } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { listAssignments } from '@/lib/api/assignment-lifecycle-client';
import {
  statusTone,
  type Assignment,
  type AssignmentStatus,
} from '@/lib/api/assignment-lifecycle-types';

type StatusFilter = AssignmentStatus | 'all';

export default function AdminAssignmentsPage() {
  return (
    <AdminGuard
      title="Assignments"
      subtitle="See who owns each prospect and move work to the right team."
    >
      <AssignmentsView />
    </AdminGuard>
  );
}

function AssignmentsView() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('active');
  const [team, setTeam] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const page = await listAssignments({
          limit: 100,
          ...(status === 'all' ? {} : { status }),
          ...(append && nextCursor ? { cursor: nextCursor } : {}),
        });
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Assignments could not be loaded. Check the API connection and try again.',
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [nextCursor, status],
  );

  useEffect(() => {
    setTeam('all');
    setNextCursor(null);
    void load();
  }, [status]); // load intentionally follows the selected status

  const teams = useMemo(
    () =>
      [
        ...new Set(
          items.map((item) => item.teamName).filter((name): name is string => Boolean(name)),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [items],
  );
  const filtered = useMemo(
    () => (team === 'all' ? items : items.filter((item) => item.teamName === team)),
    [items, team],
  );
  const counts = useMemo(
    () => ({
      active: items.filter((item) => item.status === 'active').length,
      paused: items.filter((item) => item.status === 'paused').length,
      teamOwned: items.filter((item) => item.status !== 'completed' && !item.assignedUserId).length,
      overdue: items.filter(
        (item) =>
          item.deadlineAt && !item.endedAt && new Date(item.deadlineAt).getTime() < Date.now(),
      ).length,
    }),
    [items],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assignments"
        subtitle="Workspace-wide ownership for active and historical prospect work"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()} loading={loading}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <LinkButton href="/admin/prospects/assign" variant="primary">
              Assign prospects
            </LinkButton>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<ClipboardList className="size-5" />}
          tone="brand"
          value={counts.active}
          label="Active"
        />
        <StatTile
          icon={<ClipboardList className="size-5" />}
          tone="warning"
          value={counts.paused}
          label="Paused"
        />
        <StatTile
          icon={<UserRound className="size-5" />}
          tone="neutral"
          value={counts.teamOwned}
          label="Team-owned"
        />
        <StatTile
          icon={<ClipboardList className="size-5" />}
          tone="danger"
          value={counts.overdue}
          label="Overdue"
        />
      </div>

      <Card>
        <CardHeader
          title="Prospect ownership"
          action={
            <div className="flex flex-wrap gap-2">
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
                onChange={(value) => setStatus(value as StatusFilter)}
              />
              <FilterSelect
                label="Team"
                value={team}
                options={[
                  { value: 'all', label: 'All teams' },
                  ...teams.map((name) => ({ value: name, label: name })),
                ]}
                onChange={setTeam}
              />
            </div>
          }
        />

        {loading ? (
          <div className="h-64 animate-pulse rounded-lg bg-surface-muted" aria-busy="true" />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-ink-muted">
            No assignments match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-line-soft text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
                <tr>
                  <th className="px-3 py-3">Prospect</th>
                  <th className="px-3 py-3">Campaign</th>
                  <th className="px-3 py-3">Team</th>
                  <th className="px-3 py-3">Manager</th>
                  <th className="px-3 py-3">Prospector</th>
                  <th className="px-3 py-3">Deadline</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((item) => (
                  <tr key={item.id} className="align-middle hover:bg-surface-muted">
                    <td className="max-w-[240px] px-3 py-4">
                      <span className="block truncate font-bold text-navy">
                        {item.prospectName ?? `Prospect ${item.campaignProspectId.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-ink-muted">{item.campaignName ?? '—'}</td>
                    <td className="px-3 py-4 font-semibold text-ink">{item.teamName ?? '—'}</td>
                    <td className="px-3 py-4 text-ink-muted">{item.managerName ?? 'Not set'}</td>
                    <td className="px-3 py-4 text-ink-muted">
                      {item.assignedUserName ?? 'Team-owned'}
                    </td>
                    <td className="px-3 py-4 text-ink-muted">
                      {formatDeadline(item.deadlineAt, item.endedAt)}
                    </td>
                    <td className="px-3 py-4">
                      <Badge tone={statusTone(item.status)} dot>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <Link
                        href={`/admin/prospects?search=${encodeURIComponent(item.prospectName ?? '')}`}
                        className="font-bold text-brand hover:underline"
                      >
                        Open prospect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextCursor ? (
          <div className="mt-4 flex justify-center border-t border-line-soft pt-4">
            <Button variant="secondary" loading={loadingMore} onClick={() => void load(true)}>
              Load more assignments
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function formatDeadline(value: string | null, endedAt: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const label = date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return !endedAt && date.getTime() < Date.now() ? `Overdue · ${label}` : label;
}
