'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Map as MapIcon, ShieldAlert, Target, TrendingUp, Users } from 'lucide-react';

import { ActivityCharts } from '@/components/ui/activity-charts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { listScopedMemberships as listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { getReport } from '@/lib/api/report-client';
import {
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
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

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
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const teamId = activeWorkspace?.teamId ?? undefined;
  const ranges = [
    { value: '7', label: l('Last 7 days', '7 derniers jours') },
    { value: '30', label: l('Last 30 days', '30 derniers jours') },
    { value: '90', label: l('Last 90 days', '90 derniers jours') },
  ];

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
            setError(describeReportError(caught, language));
          }
        });
    },
    [days, language, teamId],
  );

  useLiveRefresh(load);

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
        <PageHeader title={l('Reports', 'Rapports')} />

        <Alert
          tone="danger"
          title={l('We could not load reports.', 'Impossible de charger les rapports.')}
        >
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
        title={l('Reports', 'Rapports')}
        subtitle={`${l('Generated', 'Générés le')} ${new Date(reports.funnel.generatedAt).toLocaleString(locale)}`}
        action={
          <FilterSelect
            label={l('Period', 'Période')}
            value={days}
            options={ranges}
            onChange={setDays}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Target aria-hidden="true" className="size-5" />}
          tone="brand"
          value={rateText(conversions.contactRate, language)}
          label={l('Contact rate', 'Taux de contact')}
          delta={`${formatNumber(conversions.contacted, locale)} ${l('of', 'sur')} ${formatNumber(conversions.total, locale)} ${l('prospects', 'prospects')}`}
        />

        <StatTile
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          tone="success"
          value={rateText(conversions.conversionRate, language)}
          label={l('Conversion rate', 'Taux de conversion')}
          delta={`${formatNumber(conversions.converted, locale)} ${l('converted', 'convertis')}`}
        />

        <StatTile
          icon={<Activity aria-hidden="true" className="size-5" />}
          tone="brand"
          value={actions.total}
          label={l('Activities logged', 'Actions enregistrées')}
        />

        <StatTile
          icon={<MapIcon aria-hidden="true" className="size-5" />}
          tone={
            coverage.coverageRate !== null && coverage.coverageRate < 50 ? 'warning' : 'neutral'
          }
          value={rateText(coverage.coverageRate, language)}
          label={l('Portfolio coverage', 'Couverture du portefeuille')}
          delta={`${formatNumber(coverage.untouched, locale)} ${l('never contacted', 'jamais contactés')}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader title={l('Pipeline funnel', 'Entonnoir du portefeuille')} />

          {funnel.total === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              {l('No active prospects in scope.', 'Aucun prospect actif dans le périmètre.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {funnel.stages.map((stage) => (
                <li key={stage.stage}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold text-navy">
                      {stageText(stage.stage, language)}
                    </span>

                    <span className="text-[13px] tabular-nums text-ink-muted">
                      {stage.total} · {stage.share}%
                    </span>
                  </div>

                  <div
                    className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                    role="img"
                    aria-label={`${stageText(stage.stage, language)}: ${formatNumber(stage.total, locale)} ${l('prospects', 'prospects')}, ${stage.share}%`}
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
            {formatNumber(funnel.total, locale)}{' '}
            {l(
              'active prospects. Every stage is shown, including those nobody has reached.',
              'prospects actifs. Chaque étape est affichée, y compris celles qui n’ont encore été atteintes par personne.',
            )}
          </p>
        </Card>

        <Card>
          <CardHeader title={l('Follow-ups', 'Relances')} />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon={<Activity aria-hidden="true" className="size-5" />}
              tone={followUps.overdue > 0 ? 'danger' : 'success'}
              value={followUps.overdue}
              label={l('Overdue', 'En retard')}
            />

            <StatTile
              icon={<Activity aria-hidden="true" className="size-5" />}
              tone="neutral"
              value={rateText(followUps.completionRate, language)}
              label={l('Completion rate', 'Taux de réalisation')}
            />
          </div>

          <ul className="mt-4 flex flex-col divide-y divide-line-soft">
            {Object.entries(followUps.byStatus).map(([status, total]) => (
              <li key={status} className="flex items-center justify-between py-2">
                <span className="text-[14px] capitalize text-ink">
                  {statusText(status, language)}
                </span>

                <span className="text-[14px] font-semibold tabular-nums text-navy">{total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3 xl:items-start">
        <ActivityCharts days={days} mode="channels" />

        <Card>
          <CardHeader title={l('Workload', 'Charge de travail')} />

          {reports.workload.data.byProspector.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              {l('No assignments held by an individual.', 'Aucune attribution individuelle.')}
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
                    {row.paused > 0 ? (
                      <Badge tone="warning">
                        {row.paused} {l('paused', 'en pause')}
                      </Badge>
                    ) : null}

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
              {formatNumber(reports.workload.data.teamOwned, locale)}{' '}
              {l(
                'assignment owned by the team, nobody yet.',
                'attribution détenue par l’équipe, sans responsable individuel.',
              )}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title={l('Data quality', 'Qualité des données')} />

          <StatTile
            icon={<ShieldAlert aria-hidden="true" className="size-5" />}
            tone={
              quality.completeness !== null && quality.completeness < 80 ? 'warning' : 'success'
            }
            value={rateText(quality.completeness, language)}
            label={l('Records complete', 'Fiches complètes')}
            delta={`${l('of', 'sur')} ${formatNumber(quality.total, locale)} ${l('in scope', 'dans le périmètre')}`}
          />

          <ul className="mt-4 flex flex-col divide-y divide-line-soft">
            {Object.entries(quality.missing).map(([field, total]) => (
              <li key={field} className="flex items-center justify-between py-2">
                <span className="text-[14px] capitalize text-ink">
                  {l('Missing', 'Manquant')} {fieldText(field, language)}
                </span>

                <span className="text-[14px] font-semibold tabular-nums text-navy">{total}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader title={l('Territories', 'Territoires')} />

          {reports.territories.data.items.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              {l(
                'No active territories are assigned in scope.',
                'Aucun territoire actif attribué dans le périmètre.',
              )}
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
                    {formatNumber(territory.prospects, locale)} {l('prospects', 'prospects')} ·{' '}
                    {formatNumber(territory.activities, locale)} {l('activities', 'actions')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={l('Forecast', 'Prévisions')} />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              icon={<Users aria-hidden="true" className="size-5" />}
              tone="brand"
              value={forecast.pipeline}
              label={l('Prospects in pipeline', 'Prospects dans le portefeuille')}
            />

            <StatTile
              icon={<TrendingUp aria-hidden="true" className="size-5" />}
              tone="neutral"
              value={forecast.weightedPipeline}
              label={l('Weighted pipeline', 'Portefeuille pondéré')}
            />
          </div>

          <p className="mt-4 text-[14px] text-ink-muted">
            {formatNumber(forecast.scheduledFollowUps, locale)}{' '}
            {l('follow-ups scheduled ahead.', 'relances planifiées à venir.')}
          </p>

          {/* Say plainly what this number is, so nobody treats it as a
              prediction the system is not in a position to make. */}
          <Alert
            tone="info"
            className="mt-4"
            title={l(
              'This is a pipeline view, not a prediction.',
              'Ceci est une vue du portefeuille, pas une prédiction.',
            )}
          >
            {forecast.basis}.
          </Alert>
        </Card>
      </div>

      {reports.collisions.data.total > 0 ? (
        <Card>
          <CardHeader title={l('Collisions in this period', 'Collisions sur cette période')} />

          <div className="flex flex-wrap gap-2">
            {Object.entries(reports.collisions.data.byDecision).map(([decision, total]) => (
              <Badge key={decision} tone={decision === 'block' ? 'danger' : 'warning'}>
                {decisionText(decision, language)}: {formatNumber(total, locale)}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function describeReportError(error: unknown, language: string): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'You do not hold reporting authority for this scope.',
      'Vous n’avez pas les droits de reporting sur ce périmètre.',
    );
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return l(
    'We could not reach reporting. Please try again.',
    'Impossible de joindre le reporting. Réessayez.',
  );
}

function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function rateText(value: number | null, language: string): string {
  if (value === null) return language === 'fr' ? 'Non mesuré' : 'Not measured';
  return `${value}%`;
}

function stageText(stage: string, language: string): string {
  if (language !== 'fr') return stageLabel(stage as never);
  return (
    {
      to_contact: 'À contacter',
      contact_made: 'Contact établi',
      in_progress: 'En cours',
      follow_up: 'Relance',
      qualified: 'Qualifié',
      converted: 'Converti',
    }[stage] ?? stage.replace(/_/g, ' ')
  );
}

function statusText(status: string, language: string): string {
  if (language !== 'fr') return status.replace(/_/g, ' ');
  return (
    {
      pending: 'En attente',
      scheduled: 'Planifiée',
      completed: 'Terminée',
      overdue: 'En retard',
      cancelled: 'Annulée',
    }[status] ?? status.replace(/_/g, ' ')
  );
}

function fieldText(field: string, language: string): string {
  if (language !== 'fr') return field;
  return (
    { phone: 'téléphone', coordinates: 'coordonnées', address: 'adresse', website: 'site web' }[
      field
    ] ?? field
  );
}

function decisionText(decision: string, language: string): string {
  if (language !== 'fr') return decision.replace(/_/g, ' ');
  return (
    { allow: 'autorisé', block: 'bloqué', warn: 'averti', require_override: 'dérogation requise' }[
      decision
    ] ?? decision.replace(/_/g, ' ')
  );
}
