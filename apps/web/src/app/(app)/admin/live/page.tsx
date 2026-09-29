'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio, RefreshCw } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ActionChannelIcon } from '@/components/prospector/action-channel-icon';
import { ApiError } from '@/lib/api/api-error';
import { toActionChannel } from '@/lib/api/action-types';
import { listActions } from '@/lib/api/action-client';
import type { ActionPage } from '@/lib/api/action-types';
import { listReservations } from '@/lib/api/reservation-client';
import { listRoutes } from '@/lib/api/route-client';
import type { RoutePage } from '@/lib/api/route-types';
import type { ReservationPage } from '@/lib/api/reservation-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { text } from '@/lib/workspace/copy';
export default function Page() {
  return (
    <AdminGuard title="En direct">
      <Live />
    </AdminGuard>
  );
}
function Live() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [actions, setActions] = useState<ActionPage | null>(null),
    [reservations, setReservations] = useState<ReservationPage | null>(null),
    [recent, setRecent] = useState<ActionPage | null>(null),
    [routes, setRoutes] = useState<RoutePage | null>(null),
    [error, setError] = useState(false);
  const request = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++request.current;
    try {
      const [a, r, h, f] = await Promise.all([
        listActions({ status: 'started', limit: 50 }, signal),
        listReservations({ status: 'active', limit: 50 }, signal),
        listActions({ status: 'completed', limit: 10 }, signal),
        listRoutes({ status: 'active', limit: 50 }, signal),
      ]);
      if (signal?.aborted || version !== request.current) return;
      setActions(a);
      setReservations(r);
      setRecent(h);
      setRoutes(f);
      setError(false);
    } catch (caught) {
      if (!signal?.aborted && version === request.current) {
        setError(true);
        if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) {
          setActions(null);
          setReservations(null);
          setRecent(null);
          setRoutes(null);
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
  return (
    <div className="space-y-5">
      <PageHeader
        title={l('Live activity', 'En direct')}
        subtitle={l(
          'Contact actions and reservations in progress across your teams.',
          'Les contacts et réservations en cours dans vos équipes.',
        )}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            {l('Refresh', 'Actualiser')}
          </Button>
        }
      />
      <p className="-mt-3 flex items-center gap-2 text-xs text-ink-muted">
        <Radio className="size-3.5 text-success" />
        {l(
          'Automatic refresh every 10 seconds',
          'Actualisation automatique toutes les 10 secondes',
        )}
      </p>
      {error && (
        <Alert tone="danger">
          {l('Unable to refresh activity.', 'Impossible d’actualiser l’activité.')}{' '}
          <Button variant="ghost" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </Button>
        </Alert>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[1.75fr_1fr]">
        <div className="space-y-4">
          <Card padding="none">
            <div className="px-[18px] pt-[18px]">
              <CardHeader title={l('Contacts in progress', 'Contacts en cours')} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    {[
                      l('Prospector', 'Prospecteur'),
                      l('Channel', 'Canal'),
                      l('Establishment', 'Établissement'),
                      l('Company', 'Entreprise'),
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actions?.items.map((a) => (
                    <tr key={a.id} className="border-t border-line-soft">
                      <td className="font-bold">
                        {a.actor.displayName ?? l('Team member', 'Membre de l’équipe')}
                      </td>
                      <td>
                        <ActionChannelIcon channel={toActionChannel(a.type)} />
                      </td>
                      <td>
                        <Link
                          href={`/admin/prospects/${a.establishmentId}`}
                          className="font-semibold hover:text-brand"
                        >
                          {a.establishment.name ?? a.subject}
                        </Link>
                      </td>
                      <td>{a.organization?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {actions && !actions.items.length && (
              <p className="px-[18px] py-5 text-sm text-ink-muted">
                {l(
                  'No contact in progress at the moment.',
                  'Personne n’est en contact en ce moment.',
                )}
              </p>
            )}
            {!actions && !error && (
              <div className="m-4 h-20 animate-pulse rounded bg-line-soft" aria-busy="true" />
            )}
          </Card>
          <Card>
            <CardHeader title={l('Field routes', 'Tournées terrain')} />
            {routes?.items.map((r) => (
              <Link
                key={r.id}
                href={`/routes/${r.id}`}
                className="flex justify-between gap-3 border-t border-line-soft py-3 text-sm"
              >
                <strong>{r.name}</strong>
                <span className="text-ink-muted">
                  {new Date(r.scheduledAt).toLocaleDateString(locale)}
                </span>
              </Link>
            ))}
            {routes && !routes.items.length && (
              <p className="text-sm text-ink-muted">
                {l('No active field route.', 'Aucune tournée terrain en cours.')}
              </p>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title={l('Contact reservations', 'Réservations de contact')} />
            <p className="text-sm text-ink-muted">
              {reservations
                ? `${reservations.items.length}${reservations.nextCursor ? '+' : ''}`
                : '—'}{' '}
              {l('active reservations', 'réservations actives')}
            </p>
            <Link
              href="/workspace/reservations"
              className="mt-3 inline-block text-sm font-semibold text-brand"
            >
              {l('Manage reservations', 'Gérer les réservations')}
            </Link>
          </Card>
          <Card>
            <CardHeader title={l('Latest actions', 'Dernières actions')} />
            <ul className="divide-y divide-line-soft">
              {recent?.items.map((a) => (
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
                    {a.actor.displayName ?? '—'}
                    {a.organization?.name ? ` · ${a.organization.name}` : ''}
                  </p>
                  <p className="mt-2 text-sm">{a.subject}</p>
                </li>
              ))}
            </ul>
            {recent && !recent.items.length && (
              <p className="text-sm text-ink-muted">
                {l('No completed action yet.', 'Aucune action terminée pour le moment.')}
              </p>
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
