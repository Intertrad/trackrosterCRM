'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, RefreshCw, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { getAdminDashboard } from '@/lib/api/admin-client';
import type { AdminDashboard } from '@/lib/api/admin-types';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import { listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { text } from '@/lib/workspace/copy';

export default function Page() {
  return (
    <AdminGuard title="Vue d’ensemble">
      <Overview />
    </AdminGuard>
  );
}
function Overview() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [data, setData] = useState<AdminDashboard | null>(null),
    [management, setManagement] = useState<ManagerDashboardResponse | null>(null),
    [members, setMembers] = useState<MembershipSummary[]>([]),
    [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++request.current;
    try {
      const from = new Date();
      from.setDate(from.getDate() - 14);
      const [a, m, p] = await Promise.all([
        getAdminDashboard(signal),
        getManagerDashboard({ from: from.toISOString(), to: new Date().toISOString() }, signal),
        listMemberships({ limit: 100 }, signal),
      ]);
      if (signal?.aborted || version !== request.current) return;
      setData(a);
      setManagement(m);
      setMembers(p.items);
      setError(false);
    } catch (caught) {
      if (!signal?.aborted && version === request.current) {
        setError(true);
        if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) {
          setData(null);
          setManagement(null);
          setMembers([]);
        }
      }
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => {
      c.abort();
      request.current += 1;
    };
  }, [load]);
  useLiveRefresh(load);
  const metrics = data?.metrics;
  const coverage = metrics?.totalEstablishments
    ? Math.round((100 * metrics.contactedEstablishments) / metrics.totalEstablishments)
    : null;
  const name = (id: string) => {
    const member = members.find((m) => m.id === id);
    return member ? membershipName(member) : l('Team member', 'Membre de l’équipe');
  };
  const rows = management?.byProspector ?? [];
  const days = data?.activityByDay ?? [];
  const max = Math.max(1, ...days.map((d) => d.total));
  const stats = [
    {
      value: metrics?.totalEstablishments,
      label: l('Establishments', 'Établissements'),
      color: 'bg-navy',
    },
    {
      value: coverage === null ? '—' : `${coverage} %`,
      label: l('Base coverage', 'Couverture de la base'),
      color: 'bg-brand-pale',
    },
    {
      value: management?.activities.total,
      label: l('Actions · last 14 days', 'Actions · 14 derniers jours'),
      color: 'bg-brand',
    },
    {
      value: management?.assignments.current,
      label: l('Current assignments', 'Attributions en cours'),
      color: 'bg-brand-mid',
    },
    {
      value: management?.followUps.pending,
      label: l('Pending follow-ups', 'Relances à effectuer'),
      color: 'bg-lime',
    },
  ];
  return (
    <div className="space-y-[18px]">
      <PageHeader
        title={l('Overview', 'Vue d’ensemble')}
        subtitle={l(
          'Activity over the last 14 days and the state of your base.',
          'Activité des 14 derniers jours et état de la base.',
        )}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            {l('Refresh', 'Actualiser')}
          </Button>
        }
      />
      {error && (
        <Alert tone="danger">
          {l(
            'The dashboard could not be refreshed. Retry to see current data.',
            'Le tableau de bord n’a pas pu être actualisé. Réessayez pour consulter les données à jour.',
          )}
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} padding="none" className="flex min-h-28 flex-col gap-1.5 p-4">
            <p className="text-[12.48px] font-bold text-ink-muted">{s.label}</p>
            <p className="text-[30.4px] leading-tight font-extrabold tracking-tight tabular-nums text-navy">
              {typeof s.value === 'number' ? s.value.toLocaleString(locale) : (s.value ?? '—')}
            </p>
            {s.color === 'bg-brand-pale' ? (
              <span className="h-1.5 w-full rounded bg-line-soft">
                <span
                  className="block h-full rounded bg-brand"
                  style={{ width: `${coverage ?? 0}%` }}
                />
              </span>
            ) : (
              <p className="text-[12.48px] text-ink-muted">
                {s.color === 'bg-navy'
                  ? `${metrics?.contactedEstablishments?.toLocaleString(locale) ?? '—'} ${l('already contacted', 'déjà contactés')}`
                  : s.color === 'bg-brand'
                    ? l('Recorded by your teams', 'Enregistrées par vos équipes')
                    : s.color === 'bg-lime'
                      ? l('Scheduled contacts', 'Contacts programmés')
                      : l('Across all teams', 'Toutes les équipes')}
              </p>
            )}
          </Card>
        ))}
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title={l('Actions by day (14 days)', 'Actions par jour (14 jours)')}
            action={<span className="text-xs text-ink-muted">Europe/Paris</span>}
          />
          <div
            className="flex h-[200px] items-end gap-2"
            role="img"
            aria-label={l(
              'Daily recorded activity for the past 14 days',
              'Activité enregistrée sur les 14 derniers jours',
            )}
          >
            {days.map((d) => (
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2" key={d.date}>
                <div
                  title={`${d.date} : ${d.total}`}
                  className="mx-auto w-full max-w-[34px] min-h-[2px] rounded-t-md bg-brand"
                  style={{ height: `${(d.total / max) * 85}%` }}
                />
                <span className="flex flex-col text-center text-[11px] leading-tight text-ink-muted">
                  <b className="text-navy">{Number(d.date.slice(-2))}</b>
                  <small>
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { month: 'short' })}
                  </small>
                </span>
              </div>
            ))}
          </div>
          {data && days.every((d) => !d.total) && (
            <p className="mt-3 text-sm text-ink-muted">
              {l(
                'No activity recorded in this period.',
                'Aucune activité enregistrée sur cette période.',
              )}
            </p>
          )}
          <details className="mt-3 text-xs text-ink-muted">
            <summary className="cursor-pointer">
              {l('View chart data', 'Voir les données du graphique')}
            </summary>
            <ul>
              {days.map((d) => (
                <li key={d.date}>
                  {d.date} : {d.total}
                </li>
              ))}
            </ul>
          </details>
        </Card>
        <Card>
          <CardHeader title={l('Needs attention', 'À traiter')} />
          <ul className="space-y-2">
            {rows
              .filter((r) => r.overdueFollowUps > 0)
              .map((r) => (
                <li
                  key={r.userId}
                  className="flex items-start gap-2 rounded-[9px] bg-danger-bg px-3 py-2 text-[13.76px] font-semibold text-danger"
                >
                  <Clock className="size-4 shrink-0 text-warning" />
                  {name(r.userId)} : {r.overdueFollowUps}{' '}
                  {l('overdue follow-ups', 'relances en retard')}
                </li>
              ))}
          </ul>
          {management && !rows.some((r) => r.overdueFollowUps) && (
            <p className="flex items-center gap-2 py-2 text-sm text-ink-muted">
              <ShieldCheck className="size-5 text-success" />
              {l('No overdue follow-ups.', 'Aucune relance en retard.')}
            </p>
          )}
          <Link
            href="/follow-ups"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand"
          >
            {l('Open follow-ups', 'Consulter les relances')}
            <ArrowUpRight className="size-4" />
          </Link>
        </Card>
      </div>
      <Card padding="none">
        <div className="px-5 pt-5">
          <CardHeader
            title={l('Team · 14 days', 'Équipe — 14 jours')}
            action={
              <Link href="/admin/users" className="text-sm text-brand">
                {l('Manage team', 'Gérer l’équipe')}
              </Link>
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-line-soft bg-surface-muted/50 text-xs text-ink-muted">
              <tr>
                {[
                  l('Prospector', 'Prospecteur'),
                  l('Actions', 'Actions'),
                  l('Assigned', 'Attribués'),
                  l('Follow-ups', 'Relances'),
                  l('Overdue', 'En retard'),
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-4 font-semibold">{name(r.userId)}</td>
                  <td className="px-4">{r.activities}</td>
                  <td className="px-4">{r.currentAssignments}</td>
                  <td className="px-4">{r.pendingFollowUps}</td>
                  <td className="px-4">
                    <span
                      className={
                        r.overdueFollowUps ? 'rounded-full bg-danger-bg px-2 py-1 text-danger' : ''
                      }
                    >
                      {r.overdueFollowUps}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {management && !rows.length && (
          <p className="p-6 text-sm text-ink-muted">
            {l(
              'Team activity will appear after the first assignment.',
              'L’activité de l’équipe apparaîtra après les premières attributions.',
            )}
          </p>
        )}
      </Card>
      <div className="grid gap-3.5 md:grid-cols-2">
        <Card>
          <CardHeader title={l('Workspace', 'Votre espace')} />
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              [metrics?.activeMembers, l('Members', 'Membres')],
              [metrics?.activeTeams, l('Teams', 'Équipes')],
              [metrics?.activeOrganizations, l('Companies', 'Entreprises')],
            ].map(([value, label]) => (
              <div key={label}>
                <strong className="block text-2xl">{value ?? '—'}</strong>
                <span className="text-xs text-ink-muted">{label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title={l('Data quality', 'Qualité des données')} />
          {[
            [
              l('Without a phone number', 'Sans numéro de téléphone'),
              metrics?.prospectsMissingPhone,
            ],
            [
              l('Without coordinates', 'Sans coordonnées géographiques'),
              metrics?.prospectsMissingCoordinates,
            ],
            [l('Imports to confirm', 'Imports à confirmer'), metrics?.importsAwaitingCommit],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 border-b border-line-soft py-3 text-sm last:border-0"
            >
              <span className="text-ink-muted">{label}</span>
              <strong>{typeof value === 'number' ? value.toLocaleString(locale) : '—'}</strong>
            </div>
          ))}
          <Link
            href="/admin/prospects"
            className="mt-4 inline-block text-sm font-semibold text-brand"
          >
            {l('Open the base', 'Consulter la base')}
          </Link>
        </Card>
      </div>
    </div>
  );
}
