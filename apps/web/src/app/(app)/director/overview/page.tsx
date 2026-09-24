'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Building2, Target, TrendingUp, TriangleAlert } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { getDirectorDashboard } from '@/lib/api/director-client';
import {
  formatPace,
  objectiveStatusLabel,
  objectiveStatusTone,
  rankObjectives,
  type DirectorDashboard,
} from '@/lib/api/director-types';
import { listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { getReport } from '@/lib/api/report-client';
import { formatRate, type ConversionsReport, type ReportEnvelope } from '@/lib/api/report-types';
import { useAuth } from '@/lib/auth/auth-context';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function DirectorOverviewPage() {
  const { activeWorkspace } = useAuth();

  const [days, setDays] = useState('30');
  const [dashboard, setDashboard] = useState<DirectorDashboard | null>(null);
  const [conversions, setConversions] = useState<ReportEnvelope<ConversionsReport> | null>(null);
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);

      const window = { from: from.toISOString(), to: to.toISOString() };

      return Promise.all([
        getDirectorDashboard(window, signal),
        getReport<ConversionsReport>('conversions', window, signal).catch(() => null),
      ])
        .then(([loaded, loadedConversions]) => {
          if (signal?.aborted) {
            return;
          }

          setDashboard(loaded);
          setConversions(loadedConversions);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (signal?.aborted) {
            return;
          }

          /* Director authority is a distinct grant; a denial is not a fault. */
          if (caught instanceof ApiError && caught.statusCode === 403) {
            setDenied(true);

            return;
          }

          setError(describeDirectorError(caught));
        });
    },
    [days],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();

    listMemberships({ limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((item) => [item.id, item]))))
      .catch(() => setPeople(new Map()));

    return () => controller.abort();
  }, []);

  const atRisk = useMemo(() => rankObjectives(dashboard?.objectiveRisks?.items ?? []), [dashboard]);

  if (denied) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Director overview" />

        <Alert tone="info" title="This view needs director authority.">
          Your workspace does not hold a director grant, so the cross-team rollup is not available
          here.
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Director overview" />

        <Alert tone="danger" title="We could not load the rollup.">
          {error}
        </Alert>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

        <div className="h-64 animate-pulse rounded-xl bg-line-soft" />
      </div>
    );
  }

  const workload = dashboard.workload?.items ?? [];
  const comparison = dashboard.organizationComparison?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Director overview"
        subtitle={
          activeWorkspace?.organizationId
            ? 'Rollup across the teams in your organization'
            : 'Rollup across your authorised scope'
        }
        action={<FilterSelect label="Period" value={days} options={RANGES} onChange={setDays} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Activity aria-hidden="true" className="size-5" />}
          tone="brand"
          value={dashboard.activities?.total ?? null}
          label="Activities logged"
        />

        <StatTile
          icon={<Building2 aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={dashboard.assignments?.current ?? null}
          label="Live assignments"
          delta={
            dashboard.assignments ? `${dashboard.assignments.teamOwned} owned by a team` : undefined
          }
        />

        <StatTile
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          tone="success"
          value={conversions ? formatRate(conversions.data.conversionRate) : '—'}
          label="Conversion rate"
          delta={conversions ? `${conversions.data.converted} converted` : undefined}
        />

        <StatTile
          icon={<TriangleAlert aria-hidden="true" className="size-5" />}
          tone={atRisk.length > 0 ? 'danger' : 'success'}
          value={atRisk.length}
          label="Objectives behind"
          delta={
            dashboard.objectiveRisks ? `of ${dashboard.objectiveRisks.total} tracked` : undefined
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader
            title="Objectives needing attention"
            action={
              <Link
                href="/manager/reports"
                className="text-[14px] font-semibold text-brand hover:text-brand-hover"
              >
                Open reports
              </Link>
            }
          />

          {!dashboard.objectiveRisks?.available ? (
            <Alert tone="info" title="Objective tracking is not configured.">
              No objectives are defined for this scope, so there is nothing to be behind on.
            </Alert>
          ) : atRisk.length === 0 ? (
            <div className="py-10 text-center">
              <Target aria-hidden="true" className="mx-auto size-7 text-success" />

              <p className="mt-3 text-[15px] font-semibold text-navy">
                Every objective is on track
              </p>

              <p className="mt-1 text-[14px] text-ink-muted">
                {dashboard.objectiveRisks.total} tracked in this period.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {atRisk.slice(0, 12).map((objective) => (
                <li key={objective.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {objective.name}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {objective.progress.actual} of {objective.progress.target}{' '}
                      {objective.metric.replace(/_/g, ' ')} · {formatPace(objective.progress.pace)}
                      {people.get(objective.ownerId)
                        ? ` · ${membershipName(people.get(objective.ownerId)!)}`
                        : ''}
                    </span>

                    {/* Progress against time elapsed, not against the target:
                        being 40% done is fine at week one and alarming at
                        week nine. */}
                    <span
                      className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-muted"
                      role="img"
                      aria-label={`${objective.progress.progressPercent}% complete, ${objective.progress.elapsedPercent}% of the period elapsed`}
                    >
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.min(100, objective.progress.progressPercent)}%`,
                        }}
                      />
                    </span>
                  </span>

                  <Badge tone={objectiveStatusTone(objective.progress.status)} dot>
                    {objectiveStatusLabel(objective.progress.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {dashboard.objectiveRisks?.truncated ? (
            <p className="mt-4 text-[13px] text-ink-muted">
              Showing the first {atRisk.length}; more objectives are behind than fit here.
            </p>
          ) : null}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Teams" />

            {workload.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-ink-muted">
                No team workload in this period.
              </p>
            ) : (
              <p className="text-[15px] text-ink-muted">
                {workload.length} team{workload.length === 1 ? '' : 's'} reporting into this scope.
              </p>
            )}

            <LinkButton href="/manager/team" variant="secondary" className="mt-4 w-full">
              Open team view
            </LinkButton>
          </Card>

          <Card>
            <CardHeader title="Across organizations" />

            {comparison.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-ink-muted">
                Your scope covers a single organization, so there is nothing to compare.
              </p>
            ) : (
              <p className="text-[15px] text-ink-muted">
                {comparison.length} organizations in your authorised scope.
              </p>
            )}

            <LinkButton href="/manager/exports" variant="secondary" className="mt-4 w-full">
              Export the detail
            </LinkButton>
          </Card>
        </div>
      </div>
    </div>
  );
}

function describeDirectorError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach reporting. Please try again.';
}
