'use client';

import Link from 'next/link';
import { createElement, useCallback, useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck, Building2, Activity, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { readOperation, rowsOf, isRecord } from '@/lib/workspace/client';
import { text } from '@/lib/workspace/copy';
import type { DataRecord } from '@/lib/workspace/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export function OversightOverview({ kind }: { kind: 'observer' | 'platform' }) {
  const { user, activeWorkspace } = useAuth();
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const platform = kind === 'platform';
  const allowed = platform
    ? user?.platformAdmin === true
    : ['observer', 'admin'].includes(activeWorkspace?.mode ?? '');
  const [data, setData] = useState<{ summary: DataRecord; items: DataRecord[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!allowed) return;
      setBusy(true);
      try {
        const [summary, records] = await Promise.all(
          platform
            ? [
                readOperation('GET /health/ready', {}, {}, signal),
                readOperation('GET /platform/tenants', {}, {}, signal),
              ]
            : [
                readOperation('GET /audit/overview', {}, {}, signal),
                readOperation('GET /audit/events', {}, { limit: 8 }, signal),
              ],
        );
        if (!signal?.aborted) {
          setData({
            summary: isRecord(summary.resource) ? summary.resource : {},
            items: rowsOf(records.resource),
          });
          setFailed(false);
        }
      } catch {
        if (!signal?.aborted) {
          setData(null);
          setFailed(true);
        }
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [allowed, platform],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);
  useLiveRefresh(load, { enabled: allowed, scope: kind });
  const title = platform
    ? l('Platform overview', 'Vue plateforme')
    : l('Audit overview', 'Vue d’ensemble de l’audit');
  if (!allowed)
    return (
      <>
        <PageHeader title={title} />
        <Alert tone="info">
          {l(
            'This account does not have access to this workspace.',
            'Ce compte n’a pas accès à cet espace.',
          )}
        </Alert>
      </>
    );
  const links = platform
    ? ([
        [
          '/platform/tenants',
          l('Tenants', 'Clients'),
          l('Status, configuration and usage', 'Statut, configuration et utilisation'),
          Building2,
        ],
        [
          '/platform/access',
          l('Platform access', 'Accès plateforme'),
          l(
            'Review privileged identities and grants',
            'Examiner les identités et accès privilégiés',
          ),
          Users,
        ],
        [
          '/platform/health',
          l('Service health', 'État des services'),
          l(
            'Database and coordination readiness',
            'Disponibilité de la base et de la coordination',
          ),
          Activity,
        ],
      ] as const)
    : ([
        [
          '/observer/audit',
          l('Audit trail', 'Journal d’audit'),
          l(
            'Review recorded events and their details',
            'Examiner les événements enregistrés et leurs détails',
          ),
          ShieldCheck,
        ],
        [
          '/observer/audit?section=audit-security',
          l('Security events', 'Événements de sécurité'),
          l('Inspect account and access activity', 'Consulter l’activité des comptes et des accès'),
          Users,
        ],
        [
          '/observer/audit?section=audit-assignments',
          l('Operational evidence', 'Suivi des opérations'),
          l(
            'Assignments, exceptions, collisions and exports',
            'Attributions, dérogations, collisions et exports',
          ),
          Activity,
        ],
      ] as const);
  return (
    <div className="space-y-[18px]">
      <PageHeader
        title={title}
        subtitle={
          platform
            ? l(
                'Manage the platform and its customer workspaces.',
                'Pilotez la plateforme et ses espaces clients.',
              )
            : l(
                'Review the evidence recorded in your authorized scope.',
                'Examinez les événements de votre périmètre autorisé.',
              )
        }
        action={
          <Button variant="secondary" loading={busy} onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {l('Refresh', 'Actualiser')}
          </Button>
        }
      />
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
        {platform
          ? l(
              'Platform authority is separate from customer-data access.',
              'L’accès plateforme est distinct de l’accès aux données clients.',
            )
          : l('Read-only workspace', 'Espace en lecture seule')}
      </div>
      {failed && (
        <Alert tone="danger">
          {l(
            'This view could not be loaded. Check your access and try Refresh.',
            'Impossible de charger cette vue. Vérifiez votre accès puis actualisez.',
          )}
        </Alert>
      )}
      {!data && !failed ? (
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-line-soft" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid gap-4 sm:grid-cols-3">
            {(platform
              ? [
                  [l('Customer workspaces', 'Espaces clients'), data.items.length],
                  [
                    l('Active workspaces', 'Espaces actifs'),
                    data.items.filter((row) => row.status === 'active').length,
                  ],
                  [l('Service readiness', 'Disponibilité'), l('Ready', 'Disponible')],
                ]
              : [
                  [
                    l('Recorded events', 'Événements enregistrés'),
                    Number(data.summary.events ?? 0).toLocaleString(locale),
                  ],
                  [
                    l('Distinct actors', 'Acteurs distincts'),
                    Number(data.summary.actors ?? 0).toLocaleString(locale),
                  ],
                  [
                    l('Latest event', 'Dernier événement'),
                    data.summary.latest
                      ? new Date(String(data.summary.latest)).toLocaleDateString(locale)
                      : '—',
                  ],
                ]
            ).map(([label, value]) => (
              <Card key={String(label)}>
                <p className="text-xs font-bold text-ink-muted">{label}</p>
                <p className="mt-3 text-[28px] font-extrabold text-navy">{value}</p>
              </Card>
            ))}
          </div>
        )
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {links.map(([href, name, description, icon]) => (
          <Link
            key={href}
            href={href}
            className="group rounded-[14px] border border-line bg-surface p-[18px] hover:border-brand"
          >
            {createElement(icon, { className: 'mb-4 size-6 text-brand', 'aria-hidden': true })}
            <h2 className="flex items-center justify-between text-base font-extrabold text-navy">
              {name}
              <ArrowRight className="size-4 text-brand" aria-hidden="true" />
            </h2>
            <p className="mt-2 text-sm text-ink-muted">{description}</p>
          </Link>
        ))}
      </div>
      {data && (
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="p-[18px]">
            <CardHeader
              title={
                platform
                  ? l('Customer workspaces', 'Espaces clients')
                  : l('Latest events', 'Derniers événements')
              }
            />
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-3">
                    {platform ? l('Name', 'Nom') : l('Event', 'Événement')}
                  </th>
                  <th className="px-4 py-3">
                    {platform ? l('Status', 'Statut') : l('Resource', 'Ressource')}
                  </th>
                  <th className="px-4 py-3">{l('Date', 'Date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, i) => (
                  <tr key={String(row.id ?? i)} className="border-t border-line">
                    <td className="px-4 py-3 font-semibold text-navy">
                      {String(platform ? row.name : row.action)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">
                        {String(platform ? row.status : row.resourceType)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(String(platform ? row.createdAt : row.occurredAt)).toLocaleString(
                        locale,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-muted">
                {l(
                  'No records yet. New activity will appear here automatically.',
                  'Aucun élément pour le moment. Les nouvelles activités apparaîtront automatiquement.',
                )}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
