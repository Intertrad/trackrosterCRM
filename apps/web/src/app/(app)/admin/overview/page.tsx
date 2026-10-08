'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Download,
  FileText,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getAdminDashboard } from '@/lib/api/admin-client';
import type { AdminDashboard } from '@/lib/api/admin-types';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function Page() {
  return (
    <AdminGuard title="Vue d’ensemble">
      <Overview />
    </AdminGuard>
  );
}

type Tone = 'blocking' | 'high' | 'medium' | 'low';

function Overview() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++request.current;
    try {
      const dashboard = await getAdminDashboard(signal);
      if (signal?.aborted || version !== request.current) return;
      setData(dashboard);
      setError(false);
    } catch (caught) {
      if (!signal?.aborted && version === request.current) {
        setError(true);
        if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) setData(null);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      request.current += 1;
    };
  }, [load]);

  useLiveRefresh(load);

  const metrics = data?.metrics;
  const format = (value: number | undefined) =>
    typeof value === 'number' ? value.toLocaleString(locale) : '—';
  const organizations = data?.organizations ?? [];
  const maxOrganizations = Math.max(
    1,
    ...organizations.map((organization) => organization.establishments),
  );
  const activeMembers = metrics?.activeMembers ?? 0;
  const mfaEnrolled = metrics?.mfaEnrolledMembers ?? 0;
  const pairs = metrics?.coordinationPairs ?? 0;
  const rulesSet = metrics?.coordinationRulesSet ?? 0;
  const coverage = metrics?.totalEstablishments
    ? Math.round(
        ((metrics.totalEstablishments - (metrics.establishmentsWithoutOwner ?? 0)) /
          metrics.totalEstablishments) *
          100,
      )
    : 0;

  const setup = [
    {
      label: l('Companies created', 'Entreprises créées'),
      done: (metrics?.activeOrganizations ?? 0) > 0,
    },
    { label: l('Users invited', 'Utilisateurs invités'), done: activeMembers > 0 },
    {
      label: l('Establishments imported', 'Établissements importés'),
      done: (metrics?.totalEstablishments ?? 0) > 0,
    },
    {
      label: l('Coordination matrix', 'Matrice de coordination'),
      done: rulesSet >= pairs && pairs > 0,
    },
    {
      label: l('Scripts and e-mails', 'Scripts et e-mails'),
      done: (metrics?.activeScriptTemplates ?? 0) > 0,
    },
    { label: l('Rules reviewed', 'Règles revues'), done: rulesSet > 0 },
  ];

  const blockers: Array<{
    title: string;
    detail: string;
    tone: Tone;
    href: string;
    action: string;
  }> = [];
  if (pairs > rulesSet)
    blockers.push({
      title: l('Coordination matrix is incomplete', 'La matrice de coordination est incomplète'),
      detail: l(
        `${pairs - rulesSet} company pair${pairs - rulesSet === 1 ? '' : 's'} still need a decision`,
        `${pairs - rulesSet} paire${pairs - rulesSet === 1 ? '' : 's'} d’entreprises reste${pairs - rulesSet === 1 ? '' : 'nt'} à définir`,
      ),
      tone: 'blocking',
      href: '/admin/settings',
      action: l('Configure', 'Configurer'),
    });
  if ((metrics?.establishmentsWithoutOwner ?? 0) > 0)
    blockers.push({
      title: l(
        `${format(metrics?.establishmentsWithoutOwner)} establishments without an owner`,
        `${format(metrics?.establishmentsWithoutOwner)} établissements sans responsable`,
      ),
      detail: l(
        'The engine does not protect a record until it is assigned',
        'Le moteur ne protège pas un établissement tant qu’il n’est pas attribué',
      ),
      tone: 'blocking',
      href: '/admin/prospects/assign',
      action: l('Assign', 'Attribuer'),
    });
  if ((metrics?.pendingDuplicateReviews ?? 0) > 0)
    blockers.push({
      title: l(
        `${format(metrics?.pendingDuplicateReviews)} duplicates to review`,
        `${format(metrics?.pendingDuplicateReviews)} doublons à examiner`,
      ),
      detail: l(
        'Resolve them before campaigns start',
        'Résolvez-les avant de lancer les campagnes',
      ),
      tone: 'high',
      href: '/admin/prospects',
      action: l('Review', 'Examiner'),
    });
  if ((metrics?.incompleteOrganizations ?? 0) > 0)
    blockers.push({
      title: l(
        `${format(metrics?.incompleteOrganizations)} company profiles are incomplete`,
        `${format(metrics?.incompleteOrganizations)} profils d’entreprise sont incomplets`,
      ),
      detail: l(
        'Complete legal, billing and contact details',
        'Complétez les informations légales et de contact',
      ),
      tone: 'medium',
      href: '/admin/organizations',
      action: l('Finish', 'Terminer'),
    });
  if ((metrics?.activeScriptTemplates ?? 0) === 0)
    blockers.push({
      title: l('No script or e-mail template', 'Aucun script ou modèle e-mail'),
      detail: l(
        'Prospectors will write their own wording',
        'Les prospecteurs devront rédiger leurs messages',
      ),
      tone: 'medium',
      href: '/admin/scripts',
      action: l('Create', 'Créer'),
    });
  if ((metrics?.pendingInvitations ?? 0) > 0)
    blockers.push({
      title: l(
        `${format(metrics?.pendingInvitations)} invitations pending`,
        `${format(metrics?.pendingInvitations)} invitations en attente`,
      ),
      detail: l(
        'Some invitations have not been accepted yet',
        'Certaines invitations n’ont pas encore été acceptées',
      ),
      tone: 'low',
      href: '/admin/users',
      action: l('Resend', 'Renvoyer'),
    });

  const exportDashboard = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Establishments', String(metrics?.totalEstablishments ?? 0)],
      ['Establishments without owner', String(metrics?.establishmentsWithoutOwner ?? 0)],
      ['Active users', String(metrics?.activeMembers ?? 0)],
      ['Pending duplicate reviews', String(metrics?.pendingDuplicateReviews ?? 0)],
      ...organizations.map((organization) => [
        `Establishments · ${organization.name}`,
        String(organization.establishments),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trackroster-workspace-overview.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-muted">
            <span className="text-brand">{l('Workspace', 'Espace de travail')}</span>
            <span aria-hidden="true">/</span>
            <span>{l('Overview', 'Vue d’ensemble')}</span>
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.03em] text-navy sm:text-[35px]">
            {l('Workspace overview', 'Vue d’ensemble de l’espace')}
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            {l('Workspace ·', 'Espace ·')} {format(metrics?.activeOrganizations)}{' '}
            {l('companies ·', 'entreprises ·')} {format(metrics?.totalEstablishments)}{' '}
            {l('establishments ·', 'établissements ·')} {format(metrics?.activeMembers)}{' '}
            {l('users', 'utilisateurs')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportDashboard} disabled={!data}>
            <Download className="size-4" />
            {l('Export', 'Exporter')}
          </Button>
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-[14.4px] font-bold text-white transition-colors duration-150 hover:bg-brand-hover active:bg-brand-active sm:min-h-10"
          >
            <UserPlus className="size-4" />
            {l('Invite a user', 'Inviter un utilisateur')}
          </Link>
        </div>
      </header>

      {error && (
        <Alert tone="danger">
          {l(
            'The dashboard could not be refreshed. Retry to see current data.',
            'Le tableau de bord n’a pas pu être actualisé. Réessayez pour consulter les données à jour.',
          )}
        </Alert>
      )}

      <Card className="border-warning/40 bg-warning-bg/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-navy">
              {l(
                `Workspace setup — ${setup.filter((step) => step.done).length} of ${setup.length} steps done`,
                `Configuration de l’espace — ${setup.filter((step) => step.done).length} étapes sur ${setup.length}`,
              )}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {setup.map((step) => (
                <span
                  key={step.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${step.done ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}
                >
                  {step.done ? (
                    <Check className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  {step.label}
                </span>
              ))}
            </div>
          </div>
          <Link
            href={blockers[0]?.href ?? '/admin/settings'}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-[14.4px] font-bold text-white transition-colors duration-150 hover:bg-brand-hover active:bg-brand-active sm:min-h-10"
          >
            {l('Continue setup', 'Continuer la configuration')}
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          value={format(metrics?.totalEstablishments)}
          label={l('Establishments', 'Établissements')}
          detail={l(
            `${format(metrics?.activeOrganizations)} companies share them`,
            `${format(metrics?.activeOrganizations)} entreprises les partagent`,
          )}
        />
        <MetricCard
          value={format(metrics?.establishmentsWithoutOwner)}
          label={l('Without an owner', 'Sans responsable')}
          detail={l('not protected by the engine', 'non protégés par le moteur')}
          danger
        />
        <MetricCard
          value={format(metrics?.activeMembers)}
          label={l('Users', 'Utilisateurs')}
          detail={l(
            `${format(metrics?.pendingInvitations)} invitations pending`,
            `${format(metrics?.pendingInvitations)} invitations en attente`,
          )}
        />
        <MetricCard
          value={format(metrics?.pendingDuplicateReviews)}
          label={l('Duplicates to review', 'Doublons à examiner')}
          detail={l('pending duplicate decisions', 'décisions de doublons en attente')}
          warning
        />
        <MetricCard
          value={format(rulesSet)}
          label={l('Coordination rules set', 'Règles de coordination')}
          detail={l(
            `${format(Math.max(0, pairs - rulesSet))} pairs to decide`,
            `${format(Math.max(0, pairs - rulesSet))} paires à définir`,
          )}
          danger={pairs > rulesSet}
        />
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(290px,0.9fr)]">
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="text-base font-extrabold text-navy">
              {l('What blocks the pilot', 'Ce qui bloque le pilote')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {l('In the order the dossier recommends', 'Dans l’ordre recommandé par le dossier')}
            </p>
          </div>
          {blockers.length ? (
            <ul>
              {blockers.map((blocker) => (
                <li
                  key={blocker.title}
                  className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-4 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy">{blocker.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{blocker.detail}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClass(blocker.tone)}`}
                  >
                    {blocker.tone}
                  </span>
                  <Link
                    href={blocker.href}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-bold text-navy hover:border-brand hover:text-brand"
                  >
                    {blocker.action}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-success">
              <ShieldCheck className="size-5" />
              {l('No blocking setup items remain.', 'Aucun blocage de configuration restant.')}
            </div>
          )}
        </Card>

        <div className="space-y-3.5">
          <Card>
            <h2 className="text-base font-extrabold text-navy">
              {l('Establishments per company', 'Établissements par entreprise')}
            </h2>
            <div className="mt-4 space-y-4">
              {organizations.map((organization) => (
                <div key={organization.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-navy">{organization.name}</span>
                    <span className="text-ink-muted">{format(organization.establishments)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max(organization.establishments ? 7 : 0, (organization.establishments / maxOrganizations) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {!organizations.length && (
                <p className="text-sm text-ink-muted">
                  {l('No companies available.', 'Aucune entreprise disponible.')}
                </p>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="text-base font-extrabold text-navy">{l('Security', 'Sécurité')}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {l('Non-negotiable for every account.', 'Une exigence pour chaque compte.')}
            </p>
            <dl className="mt-3 divide-y divide-line-soft">
              <SecurityRow
                label={l('MFA coverage', 'Couverture MFA')}
                value={`${format(mfaEnrolled)} / ${format(activeMembers)}`}
              />
              <SecurityRow
                label={l('Password policy', 'Politique de mot de passe')}
                value={`${format(metrics?.passwordMinLength)} ${l('characters', 'caractères')}`}
              />
              <SecurityRow
                label={l('Sessions', 'Sessions')}
                value={`${format(metrics?.sessionMaxHours)} h ${l('expiry', 'expiration')}`}
              />
              <SecurityRow
                label="SSO"
                value={
                  metrics?.ssoConfigured ? l('Enabled', 'Activé') : l('Not enabled', 'Non activé')
                }
                muted={!metrics?.ssoConfigured}
              />
            </dl>
          </Card>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <FileText className="size-4" />
        {l(
          `Base coverage: ${coverage}% of active establishments have an owner or recorded activity.`,
          `Couverture : ${coverage}% des établissements actifs ont un responsable ou une activité enregistrée.`,
        )}
      </p>
    </div>
  );
}

function MetricCard({
  value,
  label,
  detail,
  danger,
  warning,
}: {
  value: string;
  label: string;
  detail: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <Card
      className={`min-h-[108px] ${danger ? 'border-danger/30' : warning ? 'border-warning/40' : ''}`}
    >
      <p
        className={`text-[30px] font-extrabold tracking-[-0.04em] ${danger ? 'text-danger' : warning ? 'text-warning' : 'text-navy'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm font-bold text-navy">{label}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </Card>
  );
}
function SecurityRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-bold ${muted ? 'text-warning' : 'text-navy'}`}>{value}</dd>
    </div>
  );
}
function toneClass(tone: Tone) {
  switch (tone) {
    case 'blocking':
      return 'bg-danger-bg text-danger';
    case 'high':
      return 'bg-warning-bg text-warning';
    case 'medium':
      return 'bg-brand-pale text-brand';
    case 'low':
      return 'bg-brand-pale text-brand';
  }
}
