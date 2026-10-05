'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FilterSelect } from '@/components/ui/filter-select';
import { ApiError } from '@/lib/api/api-error';
import { getDirectorDashboard } from '@/lib/api/director-client';
import type { DirectorDashboard } from '@/lib/api/director-types';
import { listScopedMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function DirectorPerformancePage() {
  const [days, setDays] = useState('30');
  const [dashboard, setDashboard] = useState<DirectorDashboard | null>(null);
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 86_400_000);
      try {
        const result = await getDirectorDashboard(
          { from: from.toISOString(), to: to.toISOString() },
          signal,
        );
        if (!signal?.aborted) {
          setDashboard(result);
          setError(null);
        }
      } catch (caught) {
        if (!signal?.aborted)
          setError(
            caught instanceof ApiError && caught.statusCode === 403
              ? 'You do not hold director reporting authority for this scope.'
              : 'We could not load team performance.',
          );
      }
    },
    [days],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    listScopedMemberships({ status: 'active', limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((person) => [person.id, person]))))
      .catch(() => setPeople(new Map()));
    return () => controller.abort();
  }, [load]);

  const rows = dashboard?.byProspector ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team Performance"
        subtitle="Comparative execution and conversion · selected period"
        action={<FilterSelect label="Period" value={days} options={PERIODS} onChange={setDays} />}
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        <CardHeader title="Prospector performance" />
        {dashboard === null ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
            No prospectors returned in this scope.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  <th className="px-5 py-3">Team / member</th>
                  <th className="px-3 py-3">Prospects</th>
                  <th className="px-3 py-3">Actions</th>
                  <th className="px-3 py-3">Open follow-ups</th>
                  <th className="px-3 py-3">Overdue</th>
                  <th className="px-3 py-3">Late completed</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((row) => {
                  const person = people.get(row.userId);
                  return (
                    <tr key={row.userId}>
                      <td className="px-5 py-3.5 font-semibold text-navy">
                        {person ? membershipName(person) : row.userId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-ink">
                        {row.currentAssignments}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-ink">{row.activities}</td>
                      <td className="px-3 py-3.5 tabular-nums text-ink">{row.pendingFollowUps}</td>
                      <td className="px-3 py-3.5 tabular-nums text-ink">{row.overdueFollowUps}</td>
                      <td className="px-3 py-3.5 tabular-nums text-ink">
                        {row.lateCompletedFollowUps ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge tone={row.overdueFollowUps > 0 ? 'warning' : 'success'} dot>
                          {row.overdueFollowUps > 0 ? 'Needs attention' : 'On track'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Alert tone="info" title="Additional comparison fields are not exposed yet.">
        The director API currently provides assignments, actions and follow-up workload per
        prospector. Contacts, opportunities, conversion rate and on-time follow-ups require a
        team-performance aggregation endpoint before they can be shown accurately.
      </Alert>
    </div>
  );
}
