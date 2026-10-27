'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Map as MapIcon, Pencil, Plus } from 'lucide-react';

import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { listScopedMemberships as listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';
import { getReport } from '@/lib/api/report-client';
import type { ReportEnvelope, TerritoriesReport } from '@/lib/api/report-types';
import {
  getTerritoryMap,
  listTerritories,
  listTerritoryAssignments,
} from '@/lib/api/territory-client';
import type {
  Territory,
  TerritoryAssignment,
  TerritoryFeatureCollection,
} from '@/lib/api/territory-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

type TerritoryReport = ReportEnvelope<TerritoriesReport>;

export default function ManagerTerritoriesPage() {
  const { activeWorkspace } = useAuth();
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const teamId = activeWorkspace?.teamId ?? undefined;
  const [territories, setTerritories] = useState<Territory[] | null>(null);
  const [boundaries, setBoundaries] = useState<TerritoryFeatureCollection | null>(null);
  const [assignments, setAssignments] = useState<TerritoryAssignment[] | null>(null);
  const [report, setReport] = useState<TerritoryReport | null>(null);
  const [memberships, setMemberships] = useState<Map<string, MembershipSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

      try {
        const [territoryRows, map, assignmentPage, territoryReport, people] = await Promise.all([
          listTerritories(signal),
          getTerritoryMap(signal),
          listTerritoryAssignments(
            /* The participation API caps one page at 100 rows. The previous
             * 1000-row request was rejected by DTO validation, which caused
             * the Promise.all below to blank the entire territory screen. */
            { ...(teamId ? { teamId } : {}), state: 'active', limit: 100 },
            signal,
          ),
          getReport<TerritoriesReport>(
            'territories',
            { from: from.toISOString(), to: to.toISOString(), ...(teamId ? { teamId } : {}) },
            signal,
          ),
          listMemberships({ ...(teamId ? { teamId } : {}), status: 'active', limit: 100 }, signal),
        ]);

        if (signal?.aborted) return;
        setTerritories(territoryRows);
        setBoundaries(map);
        setAssignments(assignmentPage.items);
        setReport(territoryReport);
        setMemberships(new Map(people.items.map((person) => [person.id, person])));
        setError(null);
      } catch (caught) {
        if (signal?.aborted) return;
        setError(
          caught instanceof ApiError && caught.statusCode === 403
            ? l(
                'You do not have territory reporting access for this scope.',
                'Vous n’avez pas accès aux rapports territoriaux de ce périmètre.',
              )
            : l(
                'We could not load territories. Please try again.',
                'Impossible de charger les territoires. Réessayez.',
              ),
        );
      }
    },
    [language, teamId],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reportById = useMemo(
    () => new Map((report?.data.items ?? []).map((row) => [row.territoryId, row])),
    [report],
  );
  const assignmentById = useMemo(
    () => new Map((assignments ?? []).map((assignment) => [assignment.territoryId, assignment])),
    [assignments],
  );
  const points = useMemo<MapPoint[]>(() => {
    return (territories ?? []).flatMap((territory) => {
      const coordinates = territory.center?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
      return toMapPoint(territory.id, territory.name, coordinates[1], coordinates[0], 'to_contact');
    });
  }, [territories]);
  const totals = useMemo(() => {
    const rows = report?.data.items ?? [];
    const prospects = rows.reduce((sum, row) => sum + row.prospects, 0);
    const activities = rows.reduce((sum, row) => sum + row.activities, 0);
    const all = territories ?? [];
    const unassigned = all.filter((territory) => !assignmentById.has(territory.id));
    return {
      prospects,
      activityRate: prospects ? Math.min(100, Math.round((activities / prospects) * 100)) : null,
      assigned: all.length - unassigned.length,
      unassigned,
    };
  }, [assignmentById, report, territories]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l('Territories', 'Territoires')}
        subtitle={l(
          'Coverage, ownership and gaps across your authorised scope',
          'Couverture, responsables et écarts sur votre périmètre autorisé',
        )}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/workspace/territories"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              <Pencil aria-hidden="true" className="size-4" />{' '}
              {l('Edit boundaries', 'Modifier les limites')}
            </Link>
            <Link
              href="/workspace/territories"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-3.5 text-[13px] font-bold text-white hover:bg-brand-hover"
            >
              <Plus aria-hidden="true" className="size-4" />{' '}
              {l('New territory', 'Nouveau territoire')}
            </Link>
          </div>
        }
      />

      {error ? (
        <Alert tone="danger">
          {error}
          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            {l('Try again', 'Réessayer')}
          </Button>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(390px,1fr)] xl:items-start">
        <div className="flex flex-col gap-3">
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
              <div>
                <h2 className="text-[15px] font-bold text-navy">
                  {l('Territory map', 'Carte des territoires')}
                </h2>
                <p className="text-[12px] text-ink-muted">
                  {l(
                    'Boundaries and territory centres from the API',
                    'Limites et centres des territoires issus de l’API',
                  )}
                </p>
              </div>
              <MapIcon aria-hidden="true" className="size-5 text-brand" />
            </div>
            <ProspectMap points={points} territories={boundaries} />
          </Card>
          {totals.unassigned.length ? (
            <Alert
              tone="danger"
              title={`${totals.unassigned.length} ${l('territories need an owner', 'territoires ont besoin d’un responsable')}`}
            >
              {totals.unassigned
                .slice(0, 3)
                .map((territory) => territory.name)
                .join(', ')}
              {totals.unassigned.length > 3 ? ` ${l('and more', 'et plus')}` : ''}.{' '}
              {l(
                'Assign an owner from the territory tools.',
                'Attribuez un responsable depuis les outils territoriaux.',
              )}
              <Link href="/workspace/territories" className="ml-1 font-bold underline">
                {l('Assign now →', 'Attribuer maintenant →')}
              </Link>
            </Alert>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card padding="none" className="overflow-hidden">
            <CardHeader title={l('Territory summary', 'Résumé territorial')} />
            {territories === null ? (
              <RowsSkeleton />
            ) : territories.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
                {l('No territories in scope.', 'Aucun territoire dans ce périmètre.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                      <th className="px-5 py-3">{l('Territory', 'Territoire')}</th>
                      <th className="px-3 py-3">{l('Owner', 'Responsable')}</th>
                      <th className="px-3 py-3 text-right">{l('Prospects', 'Prospects')}</th>
                      <th className="px-5 py-3 text-right">{l('Activity', 'Activité')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {territories.map((territory) => {
                      const row = reportById.get(territory.id);
                      const assignment = assignmentById.get(territory.id);
                      const owner = assignment?.membershipId
                        ? memberships.get(assignment.membershipId)
                        : undefined;
                      return (
                        <tr key={territory.id}>
                          <td className="px-5 py-3">
                            <span className="block font-semibold text-navy">{territory.name}</span>
                            {territory.code ? (
                              <span className="text-[12px] text-ink-muted">{territory.code}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-[13px] text-ink">
                            {owner
                              ? membershipName(owner)
                              : assignment?.teamId
                                ? l('Team owner', 'Responsable d’équipe')
                                : l('Unassigned', 'Non attribué')}
                          </td>
                          <td className="px-3 py-3 text-right text-[13px] tabular-nums text-navy">
                            {row?.prospects ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Badge tone={assignment ? 'success' : 'danger'} dot>
                              {assignment
                                ? `${row?.activities ?? 0} ${l('actions', 'actions')}`
                                : l('Gap', 'Écart')}
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

          <Card>
            <CardHeader
              title={l('Capacity', 'Capacité')}
              action={<Download aria-hidden="true" className="size-4 text-ink-muted" />}
            />
            <dl className="divide-y divide-line-soft text-[13px]">
              <SummaryRow
                label={l('Prospects in territories', 'Prospects dans les territoires')}
                value={report ? String(totals.prospects) : '—'}
              />
              <SummaryRow
                label={l('Territories with an owner', 'Territoires avec responsable')}
                value={territories ? `${totals.assigned} / ${territories.length}` : '—'}
              />
              <SummaryRow
                label={l('Activity rate (last 30 days)', 'Taux d’activité (30 derniers jours)')}
                value={totals.activityRate === null ? '—' : `${totals.activityRate}%`}
              />
              <SummaryRow
                label={l('Unassigned territories', 'Territoires non attribués')}
                value={territories ? String(totals.unassigned.length) : '—'}
                danger={totals.unassigned.length > 0}
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={danger ? 'font-bold text-danger' : 'font-bold tabular-nums text-navy'}>
        {value}
      </dd>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-2 p-5" aria-busy="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
      ))}
    </div>
  );
}
