'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Unlock,
  LockKeyhole,
  ShieldAlert,
  UserCheck,
  Activity,
  Users,
} from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ProspectMap, toMapPoint } from '@/components/prospector/prospect-map';
import { ApiError } from '@/lib/api/api-error';
import { listActions } from '@/lib/api/action-client';
import type { ActionPage, ActionRecord } from '@/lib/api/action-types';
import { listReservations, releaseReservation } from '@/lib/api/reservation-client';
import type { Reservation, ReservationPage } from '@/lib/api/reservation-types';
import { listRoutes } from '@/lib/api/route-client';
import type { RoutePage } from '@/lib/api/route-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { text } from '@/lib/workspace/copy';
import { getAdminDashboard } from '@/lib/api/admin-client';
import type { AdminDashboard } from '@/lib/api/admin-types';

export default function Page() {
  return (
    <AdminGuard title="En direct">
      <Live />
    </AdminGuard>
  );
}

type Session = { key: string; actor: string; company: string; actions: ActionRecord[] };

function Live() {
  const { language, locale: rawLocale } = useTranslation();
  const locale = rawLocale ?? 'en-US';
  const l = (en: string, fr: string): string => text(en, fr, language) ?? en;
  const [actions, setActions] = useState<ActionPage | null>(null);
  const [reservations, setReservations] = useState<ReservationPage | null>(null);
  const [recent, setRecent] = useState<ActionPage | null>(null);
  const [routes, setRoutes] = useState<RoutePage | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++request.current;
    try {
      const [started, active, completed, fieldRoutes, adminDashboard] = await Promise.all([
        listActions({ status: 'started', limit: 100 }, signal),
        listReservations({ status: 'active', limit: 100 }, signal),
        listActions({ status: 'completed', limit: 10 }, signal),
        listRoutes({ status: 'active', limit: 50 }, signal),
        getAdminDashboard(signal),
      ]);
      if (signal?.aborted || version !== request.current) return;
      setActions(started);
      setReservations(active);
      setRecent(completed);
      setRoutes(fieldRoutes);
      setDashboard(adminDashboard);
      setError(false);
    } catch (caught) {
      if (!signal?.aborted && version === request.current) {
        setError(true);
        if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) {
          setActions(null);
          setReservations(null);
          setRecent(null);
          setRoutes(null);
          setDashboard(null);
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
  useLiveRefresh(load, { interval: 30_000, enabled: !paused });

  const sessions = useMemo(() => groupSessions(actions?.items ?? []), [actions]);
  const mapPoints = useMemo(
    () =>
      (actions?.items ?? []).flatMap((a) =>
        toMapPoint(
          a.establishment.id,
          a.establishment.name ?? a.subject,
          a.establishment.latitude,
          a.establishment.longitude,
          'in_progress',
          `/admin/prospects/${a.establishmentId}`,
        ),
      ),
    [actions],
  );
  const release = async (reservation: Reservation) => {
    setReleasing(reservation.id);
    try {
      await releaseReservation(
        reservation.id,
        crypto.randomUUID(),
        'Released by administrator from live activity',
      );
      await load();
    } catch {
      setError(true);
    } finally {
      setReleasing(null);
    }
  };
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const reservationCount = reservations?.items.length ?? 0;
  const live = dashboard?.liveSummary;

  return (
    <div className="space-y-5">
      <PageHeader
        title={l('Live activity', 'En direct')}
        subtitle={`${dayLabel} — ${sessions.length} ${l('sessions in progress', 'sessions en cours')}, ${reservationCount} ${l('establishments reserved', 'établissements réservés')}. ${l('Automatic refresh every 30 seconds.', 'Actualisation automatique toutes les 30 secondes.')}`}
        action={
          <Button variant="secondary" onClick={() => setPaused((current) => !current)}>
            <RefreshCw className="size-4" />
            {paused
              ? l('Resume refresh', 'Reprendre l’actualisation')
              : l('Pause refresh', 'Suspendre l’actualisation')}
          </Button>
        }
      />
      {error && (
        <Alert tone="danger">
          {l('Unable to refresh live activity.', 'Impossible d’actualiser l’activité en direct.')}{' '}
          <Button variant="ghost" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </Button>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          icon={<LockKeyhole className="size-5" />}
          tone="brand"
          value={live?.activeLocks ?? reservationCount}
          label={l('Locks active', 'Verrous actifs')}
          delta={l('Calls and visits in progress', 'Appels et visites en cours')}
        />
        <StatTile
          icon={<ShieldAlert className="size-5" />}
          tone="danger"
          value={live?.blockedLastHour ?? null}
          label={l('Blocked in the last hour', 'Bloqués cette heure')}
        />
        <StatTile
          icon={<UserCheck className="size-5" />}
          tone="warning"
          value={live?.approvalsWaiting ?? null}
          label={l('Approvals waiting', 'Approbations en attente')}
        />
        <StatTile
          icon={<Activity className="size-5" />}
          value={live?.actionsToday ?? null}
          label={l('Actions today', 'Actions aujourd’hui')}
          delta={l('Across the workspace', 'Dans l’espace de travail')}
        />
        <StatTile
          icon={<Users className="size-5" />}
          tone="success"
          value={live?.usersOnline ?? null}
          label={l('Users online', 'Utilisateurs en ligne')}
        />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[1.75fr_1fr]">
        <div className="space-y-4">
          <Card padding="none">
            <div className="px-[18px] pt-[18px]">
              <CardHeader title={l('Sessions today', 'Sessions du jour')} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    {[
                      l('Prospector', 'Prospecteur'),
                      l('Mode', 'Mode'),
                      l('Progress', 'Avancement'),
                      l('Last action', 'Dernière action'),
                      l('Gaps', 'Écarts'),
                      '',
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-bold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow key={session.key} session={session} locale={locale} l={l} />
                  ))}
                </tbody>
              </table>
            </div>
            {!sessions.length && (
              <Empty message={l('No sessions in progress.', 'Aucune session en cours.')} />
            )}
          </Card>
          <Card padding="none">
            <div className="px-[18px] pt-[18px]">
              <CardHeader title={l('Field routes', 'Tournées terrain')} />
            </div>
            <div className="p-3">
              <ProspectMap points={mapPoints} className="min-h-[360px] rounded-xl" />
              {!mapPoints.length && (
                <p className="px-2 py-3 text-sm text-ink-muted">
                  {l(
                    'No active locations have coordinates.',
                    'Aucun emplacement actif ne possède de coordonnées.',
                  )}
                </p>
              )}
            </div>
            {routes?.items.length ? (
              <div className="border-t border-line-soft px-[18px] py-3 text-sm text-ink-muted">
                {routes.items.length} {l('active route(s)', 'tournée(s) active(s)')}
              </div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title={l('Contacts in progress', 'Contacts en cours')} />
            <div className="divide-y divide-line-soft">
              {(reservations?.items ?? []).map((r) => (
                <ReservationRow
                  key={r.id}
                  reservation={r}
                  action={actions?.items.find((a) => a.campaignProspectId === r.campaignProspectId)}
                  releasing={releasing === r.id}
                  onRelease={release}
                  locale={locale}
                  l={l}
                />
              ))}
            </div>
            {!reservationCount && (
              <Empty message={l('No active contact reservations.', 'Aucune réservation active.')} />
            )}
          </Card>
          <Card>
            <CardHeader title={l('Latest actions', 'Dernières actions')} />
            <ul className="divide-y divide-line-soft">
              {(recent?.items ?? []).map((a) => (
                <li key={a.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/prospects/${a.establishmentId}`}
                      className="text-sm font-bold hover:text-brand"
                    >
                      {a.establishment.name ?? a.subject}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {a.completedAt
                        ? new Date(a.completedAt).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {a.subject} — {a.actor.displayName ?? '—'}
                    {a.organization?.name ? ` · ${a.organization.name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            {!recent?.items.length && (
              <Empty
                message={l('No completed action yet.', 'Aucune action terminée pour le moment.')}
              />
            )}
            <Link href="/actions" className="mt-4 inline-block text-sm font-semibold text-brand">
              {l('View all activity', 'Voir toute l’activité')}
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function groupSessions(items: ActionRecord[]): Session[] {
  const map = new Map<string, Session>();
  for (const action of items) {
    const key = action.actor.membershipId;
    const current = map.get(key) ?? {
      key,
      actor: action.actor.displayName ?? '—',
      company: action.organization?.name ?? '—',
      actions: [],
    };
    current.actions.push(action);
    map.set(key, current);
  }
  return [...map.values()];
}

function SessionRow({
  session,
  locale,
  l,
}: {
  session: Session;
  locale: string;
  l: (en: string, fr: string) => string;
}) {
  const completed = session.actions.filter((a) => a.status === 'completed').length;
  const total = Math.max(session.actions.length, 1);
  const latest = session.actions.reduce(
    (value, a) => Math.max(value, new Date(a.completedAt ?? a.dueAt ?? 0).getTime()),
    0,
  );
  const mode = session.actions.some((a) => a.type === 'visit')
    ? l('Field', 'Terrain')
    : l('Phone', 'Téléphone');
  return (
    <tr className="border-t border-line-soft align-middle">
      <td className="px-4 py-4 font-bold">
        <div>{session.actor}</div>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <span className="size-2 rounded-full bg-brand" />
          {session.company}
        </div>
      </td>
      <td className="px-4 py-4 text-ink-muted">{mode}</td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-28 overflow-hidden rounded-full bg-line-soft">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </span>
          <span>
            {completed}/{total}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 text-ink-muted">
        {latest
          ? new Date(latest).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>
      <td className="px-4 py-4 font-semibold">{Math.max(0, total - completed)}</td>
      <td className="px-4 py-4">
        <Link
          href={`/admin/prospects/${session.actions[0]?.establishmentId ?? ''}`}
          className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-bold text-navy hover:border-brand hover:text-brand"
        >
          {l('Open', 'Ouvrir')}
        </Link>
      </td>
    </tr>
  );
}

function ReservationRow({
  reservation,
  action,
  releasing,
  onRelease,
  locale,
  l,
}: {
  reservation: Reservation;
  action?: ActionRecord;
  releasing: boolean;
  onRelease: (reservation: Reservation) => void;
  locale: string;
  l: (en: string, fr: string) => string;
}) {
  return (
    <div className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          {action ? (
            <Link
              href={`/admin/prospects/${action.establishmentId}`}
              className="font-bold hover:text-brand"
            >
              {action.establishment.name ?? l('Reserved establishment', 'Établissement réservé')}
            </Link>
          ) : (
            <span className="font-bold">
              {l('Reserved establishment', 'Établissement réservé')}
            </span>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {action?.actor.displayName ?? '—'}
            {action?.organization?.name ? ` · ${action.organization.name}` : ''}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {l('contact since', 'contact depuis')}{' '}
            {new Date(reservation.acquiredAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
            })}
            , {l('lock until tomorrow', 'verrou jusqu’à demain')}
          </p>
        </div>
        <span className="rounded-full bg-info-bg px-2 py-1 text-xs font-bold text-info">
          {l('Active', 'Actif')}
        </span>
      </div>
      <Button
        variant="secondary"
        size="md"
        className="mt-2"
        disabled={releasing}
        onClick={() => onRelease(reservation)}
      >
        <Unlock className="size-3.5" />
        {releasing ? l('Releasing…', 'Libération…') : l('Release', 'Libérer')}
      </Button>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="px-[18px] py-5 text-sm text-ink-muted">{message}</p>;
}
