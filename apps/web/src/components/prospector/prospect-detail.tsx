'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  ChevronRight,
  Database,
  Globe,
  MapPin,
  Phone,
  PhoneCall,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { CollisionBanner } from '@/components/prospector/collision-banner';
import { OverrideRequest } from '@/components/prospector/override-request';
import { LogOutcomeDrawer } from '@/components/prospector/log-outcome-drawer';
import { ProspectTimeline } from '@/components/prospector/prospect-timeline';
import { ConsentPanel } from '@/components/prospector/consent-panel';
import { ContactPanel } from '@/components/prospector/contact-panel';
import { ReservationPanel } from '@/components/prospector/reservation-panel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { browserJson } from '@/lib/api/browser-json';
import { listProspectFollowUps } from '@/lib/api/follow-up-client';
import type { ProspectFollowUp } from '@/lib/api/follow-up-types';
import {
  getProspectCollisionDecision,
  getProspectReservation,
  getWorkQueueProspectDetail,
} from '@/lib/api/work-queue-client';
import type {
  ProspectCollisionDecision,
  ProspectReservationState,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { cn } from '@/lib/ui/cn';

type TabId = 'overview' | 'timeline' | 'actions' | 'scripts' | 'data';

const TABS: Array<{ id: TabId; label: string; fr: string }> = [
  { id: 'overview', label: 'Overview', fr: 'Informations' },
  { id: 'timeline', label: 'Timeline', fr: 'Historique' },
  { id: 'actions', label: 'Actions', fr: 'Relances' },
  { id: 'scripts', label: 'Scripts & email', fr: 'Scripts et e-mail' },
  { id: 'data', label: 'Data', fr: 'Données' },
];

type ScriptTemplate = {
  id: string;
  name: string;
  channel: 'call' | 'visit' | 'email';
  sector: string | null;
  subject: string | null;
  body: string;
  variables: string[];
  enabled: boolean;
};

export function ProspectDetail({
  campaignId,
  prospectId,
  embedded = false,
  onDirtyChange,
}: {
  campaignId: string;
  prospectId: string;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { activeWorkspace } = useAuth();
  const { language, locale } = useTranslation();
  const l = useCallback((en: string, fr: string) => text(en, fr, language), [language]);
  const teamId = activeWorkspace?.teamId ?? null;

  /* Deep-linkable, so a link can point straight at the timeline instead of
   * landing on Overview and asking the reader to find it. */
  const requestedTab = useSearchParams().get('tab');

  const [tab, setTab] = useState<TabId>(
    TABS.some((entry) => entry.id === requestedTab) ? (requestedTab as TabId) : 'overview',
  );
  const [detail, setDetail] = useState<WorkQueueProspectDetail | null>(null);
  const [collision, setCollision] = useState<ProspectCollisionDecision | null>(null);
  const [reservation, setReservation] = useState<ProspectReservationState | null>(null);
  const [followUps, setFollowUps] = useState<ProspectFollowUp[] | null>(null);
  const [scripts, setScripts] = useState<ScriptTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collisionError, setCollisionError] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [followUpsError, setFollowUpsError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);
  useLiveRefresh(refresh, { enabled: !!teamId });

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();
    const request = { campaignId, prospectId, teamId };

    async function load(): Promise<void> {
      const [detailResult, collisionResult, reservationResult, followUpResult, scriptResult] =
        await Promise.allSettled([
          getWorkQueueProspectDetail(request),
          getProspectCollisionDecision(request),
          getProspectReservation(request),
          listProspectFollowUps(request),
          browserJson<ScriptTemplate[]>('/api/scripts'),
        ]);

      if (controller.signal.aborted) {
        return;
      }

      if (detailResult.status === 'rejected') {
        setError(
          detailResult.reason instanceof ApiError && detailResult.reason.statusCode === 404
            ? l(
                'This prospect is not in your portfolio.',
                'Cet établissement ne fait pas partie de votre portefeuille.',
              )
            : describeProspectError(
                detailResult.reason,
                l(
                  'We could not load this prospect. Please try again.',
                  'Impossible de charger cet établissement. Réessayez.',
                ),
                l,
              ),
        );
        return;
      }

      setDetail(detailResult.value);
      setError(null);

      if (collisionResult.status === 'fulfilled') {
        setCollision(collisionResult.value);
        setCollisionError(null);
      } else {
        setCollision(null);
        setCollisionError(
          describeProspectError(
            collisionResult.reason,
            l(
              'Contact authorization could not be checked. Retry before contacting.',
              'Les autorisations de contact n’ont pas pu être vérifiées. Réessayez avant de contacter.',
            ),
            l,
          ),
        );
      }

      if (reservationResult.status === 'fulfilled') {
        setReservation(reservationResult.value);
        setReservationError(null);
      } else {
        setReservation(null);
        setReservationError(
          describeProspectError(
            reservationResult.reason,
            l(
              'Reservation status could not be loaded. Retry before reserving.',
              'Le statut de réservation n’a pas pu être chargé. Réessayez avant de réserver.',
            ),
            l,
          ),
        );
      }

      if (followUpResult.status === 'fulfilled') {
        setFollowUps(followUpResult.value.items);
        setFollowUpsError(false);
      } else {
        setFollowUps(null);
        setFollowUpsError(true);
      }

      setScripts(scriptResult.status === 'fulfilled' ? scriptResult.value : null);
    }

    void load();

    return () => controller.abort();
  }, [campaignId, prospectId, refreshToken, teamId, l]);

  const pendingFollowUps = useMemo(
    () => (followUps ?? []).filter((followUp) => followUp.status === 'pending'),
    [followUps],
  );

  if (!teamId) {
    return (
      <Alert
        tone="info"
        title={l('This view is scoped to a team.', 'Cette vue est réservée à une équipe.')}
      >
        {l(
          'Switch to a team workspace to open a prospect.',
          'Sélectionnez un espace d’équipe pour ouvrir un établissement.',
        )}
      </Alert>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="danger">{error}</Alert>
        <Button variant="secondary" onClick={refresh}>
          {l('Retry', 'Réessayer')}
        </Button>

        <Link href="/work-queue" className="font-semibold text-brand hover:text-brand-hover">
          {l('Back to my prospects', 'Retour à mes établissements')}
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <DetailSkeleton />;
  }

  const establishment = detail.establishment;
  const address = [establishment.addressLine1, establishment.postalCode, establishment.city]
    .filter(Boolean)
    .join(', ');

  const blocked = collisionError !== null || collision?.decision === 'block';
  const contactAllowed = collision?.decision === 'allow' || collision?.decision === 'warn';
  const hasScheduledFollowUp = pendingFollowUps.length > 0;

  return (
    <div className={cn('flex flex-col gap-5', embedded && 'gap-0')}>
      {!embedded && (
        <nav
          aria-label={l('Breadcrumb', 'Fil d’Ariane')}
          className="flex items-center gap-1.5 text-[14px]"
        >
          <Link href="/work-queue" className="text-ink-muted hover:text-ink">
            {l('My prospects', 'Mes établissements')}
          </Link>

          <ChevronRight aria-hidden="true" className="size-4 text-line" />

          <span className="truncate font-semibold text-ink">{establishment.name}</span>
        </nav>
      )}

      <header
        className={cn(
          'flex flex-wrap items-start justify-between gap-4',
          embedded && 'border-b border-line-soft pb-4',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                'leading-tight font-extrabold tracking-[-0.025em] text-navy',
                embedded ? 'text-[22px]' : 'text-[30px] sm:text-[34px]',
              )}
            >
              {establishment.name}
            </h1>

            {embedded ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{detail.campaign.name}</Badge>
                <Badge tone={establishment.status === 'active' ? 'success' : 'neutral'} dot>
                  {establishment.status === 'active'
                    ? l('Active', 'Actif')
                    : l('Inactive', 'Inactif')}
                </Badge>
                {hasScheduledFollowUp ? (
                  <Badge tone="warning">
                    <CalendarClock aria-hidden="true" className="mr-1 inline size-3.5" />
                    {l('Scheduled follow-up', 'Relance programmée')}
                  </Badge>
                ) : null}
                {reservation?.state === 'owned' ? (
                  <Badge tone="brand">
                    <CalendarClock aria-hidden="true" className="mr-1 inline size-3.5" />
                    {l('Reserved by you', 'Réservé par vous')}
                  </Badge>
                ) : reservation?.state === 'reserved' ? (
                  <Badge tone="warning">{l('Reserved', 'Réservé')}</Badge>
                ) : null}
              </div>
            ) : (
              <Badge tone={establishment.status === 'active' ? 'success' : 'neutral'} dot>
                {establishment.status === 'active'
                  ? l('Active', 'Actif')
                  : l('Inactive', 'Inactif')}
              </Badge>
            )}
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-soft">
            {address ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {address}
              </span>
            ) : null}

            <span className="inline-flex items-center gap-1.5">
              <UserRound aria-hidden="true" className="size-4" />
              {l('Assigned to you', 'Vous est attribué')} · {detail.campaign.name}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          {embedded && establishment.phone ? (
            <Button
              disabled={blocked}
              leadingIcon={<PhoneCall aria-hidden="true" className="size-[18px]" />}
              onClick={() => window.location.assign(`tel:${establishment.phone}`)}
            >
              {l(`Call ${establishment.phone}`, `Appeler le ${establishment.phone}`)}
            </Button>
          ) : null}
          <Button
            variant={embedded ? 'secondary' : 'primary'}
            disabled={blocked}
            title={
              blocked
                ? l(
                    'Contact is blocked for this prospect',
                    'Le contact est bloqué pour cet établissement',
                  )
                : undefined
            }
            leadingIcon={<Send aria-hidden="true" className="size-[18px]" />}
            onClick={() => setDrawerOpen(true)}
          >
            {l('Log action', 'Consigner une action')}
          </Button>
        </div>
      </header>

      {collision ? (
        <div className={cn('flex flex-col gap-3', embedded && 'py-4')}>
          {embedded && contactAllowed ? (
            <div className="flex items-start gap-3 rounded-xl border border-success-border bg-success-bg px-4 py-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-navy">
                  {l('Contact allowed', 'Contact autorisé')}
                </p>
                <p className="text-[14px] text-ink-soft">
                  {l(
                    'No active collision was found for this establishment.',
                    'Aucun conflit actif n’a été détecté pour cet établissement.',
                  )}
                </p>
              </div>
            </div>
          ) : (
            <CollisionBanner decision={collision} />
          )}

          {/* A blocked prospector must have a way forward. The banner states
              the refusal; this raises the request that can lift it. */}
          {collision.decision === 'block' || collision.decision === 'require_override' ? (
            <OverrideRequest
              campaignId={campaignId}
              prospectId={prospectId}
              onRequested={refresh}
            />
          ) : null}
        </div>
      ) : null}

      {collisionError ? (
        <Alert tone="warning">
          {collisionError}{' '}
          <button className="underline" onClick={refresh}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      ) : null}

      <nav
        aria-label={l('Prospect sections', 'Rubriques de l’établissement')}
        className={cn('max-w-full', embedded && 'border-b border-line-soft pb-1')}
      >
        <ul
          className={cn(
            'inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1',
            embedded && 'w-full rounded-none bg-transparent p-0',
          )}
        >
          {TABS.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                className={cn(
                  'inline-block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  tab === item.id
                    ? embedded
                      ? 'rounded-none border-b-2 border-brand bg-transparent text-navy shadow-none'
                      : 'bg-surface text-navy shadow-sm'
                    : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
                )}
              >
                {l(item.label, item.fr)}

                {item.id === 'actions' && pendingFollowUps.length > 0 ? (
                  <span className="ml-2 rounded-full bg-brand-tint px-1.5 py-0.5 text-[12px] font-bold text-brand">
                    {pendingFollowUps.length}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={cn(
          'grid gap-5',
          !embedded && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start',
          embedded && 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:items-start',
          embedded && 'pt-4',
        )}
      >
        <div className="flex flex-col gap-5">
          {tab === 'overview' ? (
            <Card>
              <CardHeader title={l('Prospect information', 'Informations')} />

              <dl className="divide-y divide-line-soft">
                <FieldRow label={l('Campaign', 'Campagne')}>{detail.campaign.name}</FieldRow>

                <FieldRow label={l('Address', 'Adresse')}>{address || '—'}</FieldRow>

                <FieldRow label={l('Phone', 'Téléphone')}>
                  {establishment.phone ? (
                    <a
                      href={`tel:${establishment.phone}`}
                      className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
                    >
                      <Phone aria-hidden="true" className="size-4" />
                      {establishment.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </FieldRow>

                <FieldRow label={l('Website', 'Site web')}>
                  {establishment.website ? (
                    <a
                      href={establishment.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
                    >
                      <Globe aria-hidden="true" className="size-4" />
                      {l('Open site', 'Consulter le site')}
                    </a>
                  ) : (
                    '—'
                  )}
                </FieldRow>

                <FieldRow label={l('Country', 'Pays')}>{establishment.countryCode}</FieldRow>
              </dl>
            </Card>
          ) : null}

          {tab === 'timeline' ? (
            <Card>
              <CardHeader title={l('Activity history', 'Historique des actions')} />

              <ProspectTimeline
                campaignId={campaignId}
                prospectId={prospectId}
                teamId={teamId}
                refreshToken={refreshToken}
              />
            </Card>
          ) : null}

          {tab === 'actions' ? (
            <Card>
              <CardHeader title={l('Follow-ups', 'Relances')} />

              {followUpsError ? (
                <Alert tone="warning">
                  {l(
                    'Follow-ups could not be loaded. Retry to see current records.',
                    'Impossible de charger les relances. Réessayez pour consulter les données à jour.',
                  )}{' '}
                  <button className="underline" onClick={refresh}>
                    {l('Retry', 'Réessayer')}
                  </button>
                </Alert>
              ) : followUps === null ? (
                <div className="h-20 animate-pulse rounded-lg bg-line-soft" />
              ) : pendingFollowUps.length === 0 ? (
                <p className="py-6 text-center text-[15px] text-ink-muted">
                  {l(
                    'No open follow-ups for this prospect.',
                    'Aucune relance en cours pour cet établissement.',
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {pendingFollowUps.map((followUp) => (
                    <li
                      key={followUp.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3"
                    >
                      <span className="text-[15px] font-semibold text-navy">
                        {l('Due', 'Prévue le')} {formatDateTime(followUp.dueAt, locale)}
                      </span>

                      <Badge tone={followUp.ownership === 'team' ? 'brand' : 'neutral'}>
                        {followUp.ownership === 'team' ? l('Team', 'Équipe') : l('You', 'Vous')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'scripts' ? <ScriptLibrary scripts={scripts} /> : null}

          {tab === 'data' ? <DataCompleteness detail={detail} /> : null}
        </div>

        <div className="flex flex-col gap-5">
          <ReservationPanel
            campaignId={campaignId}
            prospectId={prospectId}
            teamId={teamId}
            reservation={reservation}
            reservationError={reservationError}
            onChanged={refresh}
          />

          {/* Consent is keyed by establishment, not by the campaign prospect:
              a permission holds across every campaign that reaches them. */}
          <ConsentPanel establishmentId={detail.establishment.id} onDirtyChange={onDirtyChange} />

          {/* Who to actually speak to. Keyed by establishment for the same
              reason, and sits under consent so the permission is read first. */}
          <ContactPanel establishmentId={detail.establishment.id} />

          <Card>
            <CardHeader title={l('Assignment', 'Attribution')} />

            <dl className="divide-y divide-line-soft">
              <FieldRow label={l('Assigned to', 'Attribué à')}>{l('You', 'Vous')}</FieldRow>
              <FieldRow label={l('Campaign', 'Campagne')}>{detail.campaign.name}</FieldRow>
              <FieldRow label={l('Assigned on', 'Attribué le')}>
                {formatDateTime(detail.assignment.assignedAt, locale)}
              </FieldRow>
            </dl>
          </Card>
        </div>
      </div>

      <LogOutcomeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campaignId={campaignId}
        prospectId={prospectId}
        establishmentName={establishment.name}
        reservation={reservation}
        onCompleted={refresh}
      />
    </div>
  );
}

function describeProspectError(
  error: unknown,
  fallback: string,
  l: (en: string, fr: string) => string,
): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 0) {
      return l(
        'TrackRoster could not reach the API. Confirm the backend is running and try again.',
        'TrackRoster ne peut pas joindre l’API. Vérifiez que le backend est démarré puis réessayez.',
      );
    }
    if (error.statusCode === 502 || error.statusCode === 503) {
      return l(
        'The backend service is unavailable. Start the API service and try again.',
        'Le service backend est indisponible. Démarrez l’API puis réessayez.',
      );
    }
    return error.requestId ? `${error.message} (request ${error.requestId})` : error.message;
  }

  return fallback;
}

function ScriptLibrary({ scripts }: { scripts: ScriptTemplate[] | null }) {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const available = (scripts ?? []).filter((script) => script.enabled);

  if (scripts === null) {
    return <div className="h-32 animate-pulse rounded-lg bg-line-soft" aria-busy="true" />;
  }

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader title={l('Scripts & email', 'Scripts et e-mail')} />
        <p className="py-6 text-center text-[15px] text-ink-muted">
          {l(
            'No enabled scripts are available for this workspace yet.',
            'Aucun script actif n’est encore disponible pour cet espace.',
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={l('Scripts & email', 'Scripts et e-mail')}
        action={
          <span className="text-[12px] text-ink-muted">
            {l('Read-only for prospectors', 'Lecture seule pour les prospecteurs')}
          </span>
        }
      />
      <div className="space-y-3">
        {available.map((script) => (
          <details
            key={script.id}
            className="rounded-lg border border-line-soft bg-surface-muted/40 p-3"
          >
            <summary className="cursor-pointer list-none text-[14px] font-bold text-navy">
              <span className="mr-2 rounded-full bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">
                {script.channel}
              </span>
              {script.name}
            </summary>
            {script.subject ? (
              <p className="mt-3 text-[13px] font-semibold text-ink-soft">{script.subject}</p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-ink">{script.body}</p>
            <button
              type="button"
              className="mt-3 text-[13px] font-semibold text-brand hover:text-brand-hover"
              onClick={() => void navigator.clipboard?.writeText(script.body)}
            >
              {l('Copy script', 'Copier le script')}
            </button>
          </details>
        ))}
      </div>
    </Card>
  );
}

function DataCompleteness({ detail }: { detail: WorkQueueProspectDetail }) {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const fields = [
    { label: l('Address', 'Adresse'), filled: Boolean(detail.establishment.addressLine1) },
    { label: l('Postal code', 'Code postal'), filled: Boolean(detail.establishment.postalCode) },
    { label: l('City', 'Ville'), filled: Boolean(detail.establishment.city) },
    { label: l('Phone', 'Téléphone'), filled: Boolean(detail.establishment.phone) },
    { label: l('Website', 'Site web'), filled: Boolean(detail.establishment.website) },
  ];

  const filled = fields.filter((field) => field.filled).length;
  const percent = Math.round((filled / fields.length) * 100);

  return (
    <Card>
      <CardHeader title={l('Data completeness', 'Complétude des données')} />

      <div className="flex items-center gap-4">
        <span className="text-[38px] leading-none font-bold text-navy tabular-nums">
          {percent}%
        </span>

        <span className="flex-1">
          <span
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={l('Data completeness', 'Complétude des données')}
            className="block h-2.5 w-full overflow-hidden rounded-full bg-line-soft"
          >
            <span
              className="block h-full rounded-full bg-success transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </span>

          <span className="mt-2 block text-[14px] text-ink-muted">
            {filled} / {fields.length} {l('key fields completed', 'champs principaux renseignés')}
          </span>
        </span>
      </div>

      {filled < fields.length ? (
        <div className="mt-5 rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-navy">
            <Database aria-hidden="true" className="size-4 text-warning" />
            {l('Missing fields', 'Champs manquants')}
          </p>

          <ul className="mt-1.5 list-disc pl-5 text-[14px] text-ink-soft">
            {fields
              .filter((field) => !field.filled)
              .map((field) => (
                <li key={field.label}>{field.label}</li>
              ))}
          </ul>
        </div>
      ) : null}

      {/* PATCH on establishments is admin-scoped, so a prospector sees the
          gaps but cannot edit master data from this screen. */}
      <p className="mt-4 text-[13px] text-ink-muted">
        {l(
          'Ask an administrator to correct master data — establishment records are not editable from a prospector workspace.',
          'Demandez à un administrateur de corriger ces données. Les fiches établissements ne sont pas modifiables depuis un espace prospecteur.',
        )}
      </p>
    </Card>
  );
}

function DetailSkeleton() {
  const { language } = useTranslation();
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">
        {text('Loading prospect…', 'Chargement de l’établissement…', language)}
      </span>

      <div className="h-5 w-48 rounded bg-line-soft" />
      <div className="h-10 w-2/3 rounded bg-line-soft" />
      <div className="h-14 rounded-lg bg-line-soft" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-72 rounded-xl bg-line-soft" />
        <div className="h-72 rounded-xl bg-line-soft" />
      </div>
    </div>
  );
}

function formatDateTime(value: string, locale?: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
