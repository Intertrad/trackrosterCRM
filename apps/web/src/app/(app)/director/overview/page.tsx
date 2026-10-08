'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Activity, Building2, Download, Target, TrendingUp, UserRound } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { getDirectorDashboard } from '@/lib/api/director-client';
import type { DirectorDashboard } from '@/lib/api/director-types';
import { getReport } from '@/lib/api/report-client';
import {
  formatRate,
  type ActionsReport,
  type ConversionsReport,
  type CoverageReport,
  type ReportEnvelope,
} from '@/lib/api/report-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

interface ExecutiveData {
  dashboard: DirectorDashboard;
  conversions: ReportEnvelope<ConversionsReport>;
  coverage: ReportEnvelope<CoverageReport>;
  actions: ReportEnvelope<ActionsReport>;
}

export default function DirectorOverviewPage() {
  const { language } = useTranslation();
  const l = useCallback((en: string, fr: string) => text(en, fr, language), [language]);
  const [days, setDays] = useState('30');
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 86_400_000);
      const range = { from: from.toISOString(), to: to.toISOString() };

      try {
        const [dashboard, conversions, coverage, actions] = await Promise.all([
          getDirectorDashboard(range, signal),
          getReport<ConversionsReport>('conversions', range, signal),
          getReport<CoverageReport>('coverage', range, signal),
          getReport<ActionsReport>('actions', range, signal),
        ]);

        if (signal?.aborted) return;
        setData({ dashboard, conversions, coverage, actions });
        setError(null);
      } catch (caught) {
        if (!signal?.aborted) setError(describeError(caught, language));
      }
    },
    [days, language],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const channels = useMemo(
    () =>
      Object.entries(data?.actions.data.byType ?? {})
        .map(([label, value]) => ({ label: channelLabel(label, language), value }))
        .sort((left, right) => right.value - left.value),
    [data, language],
  );
  const maxChannel = Math.max(...channels.map((channel) => channel.value), 1);
  const risks = data?.dashboard.objectiveRisks?.items ?? [];
  const periods = [
    { value: '30', label: l('Last 30 days', '30 derniers jours') },
    { value: '90', label: l('Last 90 days', '90 derniers jours') },
    { value: '180', label: l('Last 6 months', '6 derniers mois') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l('Executive Dashboard', 'Tableau de bord exécutif')}
        subtitle={l(
          'Group Arcadia · organization-wide operational read',
          'Groupe Arcadia · vue opérationnelle de l’organisation',
        )}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label={l('Period', 'Période')}
              value={days}
              options={periods}
              onChange={setDays}
            />
            <Link
              href="/director/exports"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              <Download aria-hidden="true" className="size-4" /> {l('Export', 'Exporter')}
            </Link>
          </div>
        }
      />

      {error ? (
        <Alert
          tone="danger"
          title={l(
            'We could not load the executive rollup.',
            'Impossible de charger la synthèse exécutive.',
          )}
        >
          {error}
          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            {l('Try again', 'Réessayer')}
          </Button>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          icon={<Building2 aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={data?.coverage.data.establishments ?? null}
          label={l('Establishments', 'Établissements')}
          delta={l('Scoped reporting base', 'Base de reporting du périmètre')}
        />
        <StatTile
          icon={<UserRound aria-hidden="true" className="size-5" />}
          tone="brand"
          value={data?.dashboard.activities.activeProspectors ?? null}
          label={l('Active users', 'Utilisateurs actifs')}
          delta={l('Users with activity in range', 'Utilisateurs actifs sur la période')}
        />
        <StatTile
          icon={<Target aria-hidden="true" className="size-5" />}
          tone="brand"
          value={data?.coverage.data.prospects ?? null}
          label={l('Active prospects', 'Prospects actifs')}
          delta={
            data
              ? `${formatRate(data.coverage.data.coverageRate)} ${l('coverage', 'de couverture')}`
              : undefined
          }
        />
        <StatTile
          icon={<Activity aria-hidden="true" className="size-5" />}
          tone="success"
          value={data?.conversions.data.contacted ?? null}
          label={l('Contacts made', 'Contacts établis')}
          delta={
            data
              ? `${data.actions.data.total} ${l('actions logged', 'actions enregistrées')}`
              : undefined
          }
        />
        <StatTile
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          tone="success"
          value={data?.conversions.data.qualified ?? null}
          label={l('Qualified opportunities', 'Opportunités qualifiées')}
          delta={data ? formatRate(data.conversions.data.conversionRate) : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] xl:items-start">
        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader
            title={l('Activity trend', 'Tendance de l’activité')}
            subtitle={l(
              'Actions by channel · selected period',
              'Actions par canal · période sélectionnée',
            )}
          />
          <div className="flex min-h-[236px] items-end gap-4 px-6 pb-6 pt-7 sm:gap-7">
            {channels.length ? (
              channels.slice(0, 8).map((channel, index) => (
                <div
                  key={channel.label}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <div className="flex h-40 w-full items-end justify-center">
                    <div
                      className={
                        index === 0
                          ? 'w-full max-w-10 rounded-t-md bg-brand'
                          : 'w-full max-w-10 rounded-t-md bg-brand/60'
                      }
                      style={{ height: `${Math.max(8, (channel.value / maxChannel) * 100)}%` }}
                      role="img"
                      aria-label={`${channel.label}: ${channel.value} actions`}
                    />
                  </div>
                  <span className="max-w-20 truncate text-center text-[11px] capitalize text-ink-muted">
                    {channel.label}
                  </span>
                </div>
              ))
            ) : (
              <p className="w-full self-center text-center text-[13px] text-ink-muted">
                {l(
                  'No actions were returned for this period.',
                  'Aucune action n’a été renvoyée pour cette période.',
                )}
              </p>
            )}
          </div>
          <p className="border-t border-line-soft px-6 py-3 text-[12px] text-ink-muted">
            {l(
              'The reporting API currently returns period totals by channel. A month-by-month series is not exposed yet.',
              'L’API de reporting renvoie actuellement les totaux par canal. La série mensuelle n’est pas encore disponible.',
            )}
          </p>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <CardHeader title={l('Results by channel', 'Résultats par canal')} />
          <div className="space-y-4 px-5 pb-5">
            {channels.length ? (
              channels.slice(0, 6).map((channel) => (
                <div key={channel.label}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="capitalize text-ink">{channel.label}</span>
                    <span className="font-semibold tabular-nums text-ink-muted">
                      {channel.value}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(channel.value / maxChannel) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-[14px] text-ink-muted">
                {l('No channel results in scope.', 'Aucun résultat de canal dans ce périmètre.')}
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader
            title={l('Attention points', 'Points d’attention')}
            subtitle={l('Director-scoped risks', 'Risques du périmètre directeur')}
            action={
              <Link href="/director/reports" className="text-[12px] font-bold text-brand">
                {l('View reports', 'Voir les rapports')}
              </Link>
            }
          />
          {risks.length ? (
            <ul className="divide-y divide-line-soft">
              {risks.slice(0, 6).map((risk) => (
                <li key={risk.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[14px] text-ink">{risk.name}</span>
                  <Badge tone="danger">{risk.progress.status.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
              {l('No objective risks were returned.', 'Aucun risque d’objectif n’a été renvoyé.')}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title={l('Campaign comparison', 'Comparaison des campagnes')} />
          <Alert
            tone="info"
            title={l(
              'Campaign comparison is not available from the reporting API yet.',
              'La comparaison des campagnes n’est pas encore disponible via l’API de reporting.',
            )}
          >
            {l(
              'Campaign list and lifecycle actions are connected on the Campaigns page. The backend does not currently return a single organization-wide campaign comparison with remaining prospects and progress targets.',
              'La liste des campagnes et leurs actions de cycle de vie sont disponibles sur la page Campagnes. Le backend ne renvoie pas encore une comparaison globale avec les prospects restants et les objectifs de progression.',
            )}
          </Alert>
          <Link
            href="/director/campaigns"
            className="mt-4 inline-flex text-[14px] font-bold text-brand hover:text-brand-hover"
          >
            {l('Open campaigns →', 'Ouvrir les campagnes →')}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function DashboardCardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
      <div>
        <h2 className="text-base font-extrabold text-navy">{title}</h2>
        <p className="mt-1 text-[12px] text-ink-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function describeError(error: unknown, language: string): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError))
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  if (error.statusCode === 403)
    return l(
      'You do not hold director reporting authority for this scope.',
      'Vous n’avez pas les droits de reporting directeur pour ce périmètre.',
    );
  if (error.statusCode === 400) return error.messages.join(' ');
  return l(
    'We could not reach the reporting service. Please try again.',
    'Impossible de joindre le service de reporting. Réessayez.',
  );
}

function channelLabel(value: string, language: string): string {
  const labels: Record<string, [string, string]> = {
    call: ['call', 'appel'],
    email: ['email', 'e-mail'],
    e_mail: ['email', 'e-mail'],
    message: ['message', 'message'],
    visit: ['visit', 'visite'],
    letter: ['letter', 'courrier'],
  };
  const [en, fr] = labels[value] ?? [value.replace(/_/g, ' '), value.replace(/_/g, ' ')];
  return text(en, fr, language);
}
