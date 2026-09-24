'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Map as MapIcon, ShieldAlert, Target, TrendingUp, Users } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { getReport } from '@/lib/api/report-client';
import {
  formatRate,
  stageLabel,
  type ActionsReport,
  type CollisionsReport,
  type ConversionsReport,
  type CoverageReport,
  type DataQualityReport,
  type FollowUpsReport,
  type ForecastReport,
  type FunnelReport,
  type ReportEnvelope,
  type TerritoriesReport,
  type WorkloadReport,
} from '@/lib/api/report-types';
import { useAuth } from '@/lib/auth/auth-context';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

interface Reports {
  funnel: ReportEnvelope<FunnelReport>;
  conversions: ReportEnvelope<ConversionsReport>;
  actions: ReportEnvelope<ActionsReport>;
  followUps: ReportEnvelope<FollowUpsReport>;
  workload: ReportEnvelope<WorkloadReport>;
  coverage: ReportEnvelope<CoverageReport>;
  collisions: ReportEnvelope<CollisionsReport>;
  dataQuality: ReportEnvelope<DataQualityReport>;
  territories: ReportEnvelope<TerritoriesReport>;
  forecast: ReportEnvelope<ForecastReport>;
}

export default function ReportsPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? undefined;

  const [days, setDays] = useState('30');
  const [reports, setReports] = useState<Reports | null>(null);
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);

      const filters = {
        from: from.toISOString(),
        to: to.toISOString(),
        ...(teamId ? { teamId } : {}),
      };

      return Promise.all([
        getReport<FunnelReport>('funnel', filters, signal),
        getReport<ConversionsReport>('conversions', filters, signal),
        getReport<ActionsReport>('actions', filters, signal),
        getReport<FollowUpsReport>('follow-ups', filters, signal),
        getReport<WorkloadReport>('workload', filters, signal),
        getReport<CoverageReport>('coverage', filters, signal),
        getReport<CollisionsReport>('collisions', filters, signal),
        getReport<DataQualityReport>('data-quality', filters, signal),
        getReport<TerritoriesReport>('territories', filters, signal),
        getReport<ForecastReport>('forecast', filters, signal),
      ])
        .then(
          ([
            funnel,
            conversions,
            actions,
            followUps,
            workload,
            coverage,
            collisions,
            dataQuality,
            territories,
            forecast,
          ]) => {
            if (signal?.aborted) {
              return;
            }

            setReports({
              funnel,
              conversions,
              actions,
              followUps,
              workload,
              coverage,
              collisions,
              dataQuality,
              territories,
              forecast,
            });
            setError(null);
          },
        )
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setError(describeReportError(caught));
          }
        });
    },
    [days, teamId],
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

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reports" />

        <Alert tone="danger" title="We could not load reports.">
          {error}
        </Alert>
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

        <div className="h-64 animate-pulse rounded-xl bg-line-soft" />

        <div className="h-64 animate-pulse rounded-xl bg-line-soft" />
      </div>
    );
  }

  const conversions = reports.conversions.data;
  const funnel = reports.funnel.data;
  const actions = reports.actions.data;
  const followUps = reports.followUps.data;
  const coverage = reports.coverage.data;
  const quality = reports.dataQuality.data;
  const forecast = reports.forecast.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle={`Generated ${new Date(reports.funnel.generatedAt).toLocaleString()}`}
        action={<FilterSelect label="Period" value={days} options={RANGES} onChange={setDays} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Target aria-hidden="true" className="size-5" />}
          tone="brand"
          value={formatRate(conversions.contactRate)}
          label="Contact rate"
          delta={`${conversions.contacted} of ${conversions.total} prospects`}
        />

        <StatTile
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          tone="success"
          value={formatRate(conversions.conversionRate)}
          label="Conversion rate"
          delta={`${conversions.converted} converted`}
        />

        <StatTile
          icon={<Activity aria-hidden="true" className="size-5" />}
          tone="brand"
          value={actions.total}
          label="Activities logged"
        />

        <StatTile
          icon={<MapIcon aria-hidden="true" className="size-5" />}
          tone={
            coverage.coverageRate !== null && coverage.coverageRate < 50 ? 'warning' : 'neutral'
          }
          value={formatRate(coverage.coverageRate)}
          label="Portfolio coverage"
          delta={`${coverage.untouched} never contacted`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader title="Pipeline funnel" />

          {funnel.total === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              No active prospects in scope.
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {funnel.stages.map((stage) => (
                <li key={stage.stage}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold text-navy">
                      {stageLabel(stage.stage)}
                    </span>

                    <span className="text-[13px] tabular-nums text-ink-muted">
                      {stage.total} · {stage.share}%
                    </span>
                  </div>

                  <div
                    className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                    role="img"
                    aria-label={`${stageLabel(stage.stage)}: ${stage.total} prospects, ${stage.share}%`}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${stage.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[13px] text-ink-muted">
            {funnel.total} active prospects. Every stage is shown, including those nobody has
            reached.
          </p>
        </Card>

        <Card>
          <CardHeader title="Follow-ups" />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon={<Activity aria-hidden="true" className="size-5" />}
              tone={followUps.overdue > 0 ? 'danger' : 'success'}
              value={followUps.overdue}
              label="Overdue"
            />

            <StatTile
              icon={<Activity aria-hidden="true" className="size-5" />}
              tone="neutral"
              value={formatRate(followUps.completionRate)}
              label="Completion rate"
            />
          </div>

          <ul className="mt-4 flex flex-col divide-y divide-line-soft">
            {Object.entries(followUps.byStatus).map(([status, total]) => (
              <li key={status} className="flex items-center justify-between py-2">
                <span className="text-[14px] capitalize text-ink">{status}</span>

                <span className="text-[14px] font-semibold tabular-nums text-navy">{total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3 xl:items-start">
        <Card>
          <CardHeader title="Activity by channel" />

          {Object.keys(actions.byType).length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              Nothing logged in this period.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {Object.entries(actions.byType).map(([type, total]) => (
                <li key={type} className="flex items-center justify-between py-2.5">
                  <span className="text-[14px] capitalize text-ink">{type}</span>

                  <span className="text-[14px] font-semibold tabular-nums text-navy">{total}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Workload" />

          {reports.workload.data.byProspector.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              No assignments held by an individual.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {reports.workload.data.byProspector.map((row) => (
                <li key={row.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {people.get(row.userId)
                      ? membershipName(people.get(row.userId)!)
                      : row.userId.slice(0, 8)}
                  </span>

                  <span className="flex items-center gap-2">
                    {row.paused > 0 ? <Badge tone="warning">{row.paused} paused</Badge> : null}

                    <span className="text-[14px] font-semibold tabular-nums text-navy">
                      {row.assigned}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {reports.workload.data.teamOwned > 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">
              {reports.workload.data.teamOwned} assignment
              {reports.workload.data.teamOwned === 1 ? '' : 's'} owned by the team, nobody yet.
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Data quality" />

          <StatTile
            icon={<ShieldAlert aria-hidden="true" className="size-5" />}
            tone={
              quality.completeness !== null && quality.completeness < 80 ? 'warning' : 'success'
            }
            value={formatRate(quality.completeness)}
            label="Records complete"
            delta={`of ${quality.total} in scope`}
          />

          <ul className="mt-4 flex flex-col divide-y divide-line-soft">
            {Object.entries(quality.missing).map(([field, total]) => (
              <li key={field} className="flex items-center justify-between py-2">
                <span className="text-[14px] capitalize text-ink">Missing {field}</span>

                <span className="text-[14px] font-semibold tabular-nums text-navy">{total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader title="Territories" />

          {reports.territories.data.items.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              No active territories are assigned in scope.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {reports.territories.data.items.slice(0, 10).map((territory) => (
                <li
                  key={territory.territoryId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-navy">
                      {territory.name}
                    </span>

                    {territory.code ? (
                      <span className="block text-[12px] text-ink-muted">{territory.code}</span>
                    ) : null}
                  </span>

                  <span className="text-[13px] tabular-nums text-ink-muted">
                    {territory.prospects} prospects · {territory.activities} activities
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Forecast" />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon={<Users aria-hidden="true" className="size-5" />}
              tone="brand"
              value={forecast.pipeline}
              label="Prospects in pipeline"
            />

            <StatTile
              icon={<TrendingUp aria-hidden="true" className="size-5" />}
              tone="neutral"
              value={forecast.weightedPipeline}
              label="Weighted pipeline"
            />
          </div>

          <p className="mt-4 text-[14px] text-ink-muted">
            {forecast.scheduledFollowUps} follow-up
            {forecast.scheduledFollowUps === 1 ? '' : 's'} scheduled ahead.
          </p>

          {/* Say plainly what this number is, so nobody treats it as a
              prediction the system is not in a position to make. */}
          <Alert tone="info" className="mt-4" title="This is a pipeline view, not a prediction.">
            {forecast.basis}.
          </Alert>
        </Card>
      </div>

      {reports.collisions.data.total > 0 ? (
        <Card>
          <CardHeader title="Collisions in this period" />

          <div className="flex flex-wrap gap-2">
            {Object.entries(reports.collisions.data.byDecision).map(([decision, total]) => (
              <Badge key={decision} tone={decision === 'block' ? 'danger' : 'warning'}>
                {decision.replace(/_/g, ' ')}: {total}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function describeReportError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You do not hold reporting authority for this scope.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach reporting. Please try again.';
}
