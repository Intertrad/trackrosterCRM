'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { listCollisionEvents, requestCollisionOverride } from '@/lib/api/collision-client';
import {
  canRequestOverride,
  decisionLabel,
  decisionTone,
  isCollisionExpired,
  reasonLabel,
  type CollisionEvent,
  type CollisionDecision,
  type CollisionReasonCode,
} from '@/lib/api/collision-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

const MIN_REASON = 3;

export default function CollisionCentrePage() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [events, setEvents] = useState<CollisionEvent[] | null>(null);
  const [reasonCode, setReasonCode] = useState<'all' | CollisionReasonCode>('all');
  const [decision, setDecision] = useState<'all' | 'blocked'>('all');
  const [selected, setSelected] = useState<CollisionEvent | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listCollisionEvents({ limit: 100, ...(reasonCode === 'all' ? {} : { reasonCode }) }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setEvents(page.items);
            setReadError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setEvents([]);
            setReadError(describeCollisionError(caught, language));
          }
        }),
    [language, reasonCode],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    if (!events) {
      return [];
    }

    if (decision === 'blocked') {
      return events.filter(
        (event) => event.decision === 'block' || event.decision === 'require_override',
      );
    }

    return events;
  }, [decision, events]);

  const counts = useMemo(() => {
    const all = events ?? [];

    return {
      total: all.length,
      blocked: all.filter((event) => event.decision === 'block').length,
      overrides: all.filter((event) => event.decision === 'require_override').length,
      warned: all.filter((event) => event.decision === 'warn').length,
    };
  }, [events]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l('Collision centre', 'Centre anti-collision')}
        subtitle={l(
          'What the anti-collision engine decided, and why',
          'Les décisions du moteur anti-collision et leurs motifs',
        )}
      />

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck aria-hidden="true" className="size-5" />}
          tone="brand"
          value={events === null ? null : counts.total}
          label={l('Recorded decisions', 'Décisions enregistrées')}
        />

        <StatTile
          icon={<ShieldX aria-hidden="true" className="size-5" />}
          tone={counts.blocked > 0 ? 'danger' : 'neutral'}
          value={events === null ? null : counts.blocked}
          label={l('Blocked', 'Bloquées')}
        />

        <StatTile
          icon={<ShieldAlert aria-hidden="true" className="size-5" />}
          tone={counts.overrides > 0 ? 'warning' : 'neutral'}
          value={events === null ? null : counts.overrides}
          label={l('Override required', 'Dérogation requise')}
        />

        <StatTile
          icon={<TriangleAlert aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={events === null ? null : counts.warned}
          label={l('Warned', 'Avertissements')}
        />
      </div>

      <Card>
        <CardHeader
          title={l('Collision events', 'Événements anti-collision')}
          action={
            <Link
              href="/manager/approvals"
              className="text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              {l('Open approvals', 'Ouvrir les validations')}
            </Link>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label={l('Reason', 'Motif')}
            value={reasonCode}
            options={[
              { value: 'all', label: l('All reasons', 'Tous les motifs') },
              { value: 'ACTIVE_RESERVATION', label: l('Active reservation', 'Réservation active') },
              { value: 'ACTIVE_ASSIGNMENT', label: l('Active assignment', 'Attribution active') },
              { value: 'PLANNED_ACTION', label: l('Planned action', 'Action planifiée') },
              { value: 'RECENT_CONTACT', label: l('Recent contact', 'Contact récent') },
            ]}
            onChange={(value) => setReasonCode(value as 'all' | CollisionReasonCode)}
          />

          <FilterSelect
            label={l('Decision', 'Décision')}
            value={decision}
            options={[
              { value: 'all', label: l('All decisions', 'Toutes les décisions') },
              { value: 'blocked', label: l('Blocked or needs override', 'Bloquées ou à déroger') },
            ]}
            onChange={(value) => setDecision(value as 'all' | 'blocked')}
          />
        </div>

        {events === null ? (
          <div className="mt-5 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-muted">
            {events.length === 0
              ? l(
                  'The engine has not recorded a collision for your scope.',
                  'Le moteur n’a enregistré aucune collision sur votre périmètre.',
                )
              : l('No events match these filters.', 'Aucun événement ne correspond à ces filtres.')}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2.5">
            {visible.map((event) => {
              const expired = isCollisionExpired(event);

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(event)}
                    className="w-full rounded-xl border border-line-soft px-3.5 py-3 text-left hover:border-brand"
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Badge tone={decisionTone(event.decision)} dot>
                        {decisionText(event.decision, language)}
                      </Badge>

                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
                        {reasonText(event.reasonCode, language)}
                      </span>

                      {expired ? (
                        <Badge tone="neutral">{l('Window closed', 'Fenêtre fermée')}</Badge>
                      ) : event.overrideable ? (
                        <Badge tone="brand">{l('Overrideable', 'Dérogation possible')}</Badge>
                      ) : (
                        <Badge tone="neutral">
                          {l('Policy forbids override', 'La règle interdit la dérogation')}
                        </Badge>
                      )}
                    </span>

                    <span className="mt-1 block text-[13px] text-ink-muted">
                      {l('Detected', 'Détectée le')} {formatTimestamp(event.createdAt, locale)} ·{' '}
                      {expired
                        ? `${l('closed', 'fermée le')} ${formatTimestamp(event.expiresAt, locale)}`
                        : `${l('open until', 'ouverte jusqu’au')} ${formatTimestamp(event.expiresAt, locale)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CollisionDrawer
        event={selected}
        language={language}
        locale={locale}
        onClose={() => setSelected(null)}
        onRequested={(message) => {
          setNotice(message);
          setSelected(null);
          void load();
        }}
      />
    </div>
  );
}

function CollisionDrawer({
  event,
  language,
  locale,
  onClose,
  onRequested,
}: {
  event: CollisionEvent | null;
  language: string;
  locale?: string;
  onClose: () => void;
  onRequested: (message: string) => void;
}) {
  const l = (en: string, fr: string) => text(en, fr, language);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setError(null);
    /* One key per opened event, so a retry cannot raise two requests. */
    setIdempotencyKey(event ? crypto.randomUUID() : null);
  }, [event]);

  if (!event) {
    return (
      <Drawer
        open={false}
        title={l('Collision event', 'Événement anti-collision')}
        onClose={onClose}
        children={null}
      />
    );
  }

  const allowed = canRequestOverride(event);

  return (
    <Drawer
      open
      title={l('Collision event', 'Événement anti-collision')}
      onClose={onClose}
      headerAccessory={
        <Badge tone={decisionTone(event.decision)} dot>
          {decisionText(event.decision, language)}
        </Badge>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-3">
          <Row label={l('Reason', 'Motif')}>{reasonText(event.reasonCode, language)}</Row>

          <Row label={l('Detected', 'Détectée le')}>{formatTimestamp(event.createdAt, locale)}</Row>

          <Row label={l('Window closes', 'Fin de la fenêtre')}>
            {formatTimestamp(event.expiresAt, locale)}
          </Row>

          {event.policy.defaultCoolingOffMinutes !== undefined ? (
            <Row label={l('Cooling-off', 'Délai de protection')}>
              {event.policy.defaultCoolingOffMinutes} {l('minutes', 'minutes')}
            </Row>
          ) : null}

          {event.policy.evaluatorVersion !== undefined ? (
            <Row label={l('Policy version', 'Version de la règle')}>
              {String(event.policy.evaluatorVersion)}
            </Row>
          ) : null}
        </dl>

        <Alert
          tone="info"
          title={l(
            'Conflict detail is deliberately withheld.',
            'Le détail du conflit est volontairement masqué.',
          )}
        >
          {l(
            "The engine publishes its decision and reason, not the other team's work. Who holds the conflicting claim is never disclosed here.",
            'Le moteur publie sa décision et son motif, jamais le travail de l’autre équipe. Le détenteur du conflit n’est pas révélé ici.',
          )}
        </Alert>

        {allowed ? (
          <section className="rounded-xl border border-line-soft bg-surface-muted p-4">
            <h3 className="text-[15px] font-bold text-navy">
              {l('Request an override', 'Demander une dérogation')}
            </h3>

            <p className="mt-1 text-[14px] text-ink-muted">
              {l(
                'This goes to approvals for a decision. The reason is recorded in the audit log.',
                'La demande est envoyée aux validations. Le motif est enregistré dans le journal d’audit.',
              )}
            </p>

            <TextField
              label={l('Reason', 'Motif')}
              className="mt-3"
              value={reason}
              onChange={(changed) => setReason(changed.target.value)}
              placeholder={l(
                'Why this contact should proceed',
                'Pourquoi ce contact doit continuer',
              )}
              maxLength={1000}
              disabled={busy}
              required
            />

            {error ? (
              <Alert tone="danger" className="mt-3">
                {error}
              </Alert>
            ) : null}

            <Button
              className="mt-4"
              loading={busy}
              disabled={reason.trim().length < MIN_REASON}
              onClick={() => {
                setBusy(true);
                setError(null);

                requestCollisionOverride(
                  event.id,
                  reason.trim(),
                  idempotencyKey ?? crypto.randomUUID(),
                )
                  .then(() =>
                    onRequested(l('Override request raised.', 'Demande de dérogation envoyée.')),
                  )
                  .catch((caught: unknown) => setError(describeCollisionError(caught, language)))
                  .finally(() => setBusy(false));
              }}
            >
              {l('Request override', 'Demander la dérogation')}
            </Button>
          </section>
        ) : (
          <Alert
            tone="warning"
            title={
              isCollisionExpired(event)
                ? l(
                    'This collision window has closed.',
                    'La fenêtre de cette collision est fermée.',
                  )
                : l(
                    'Policy forbids an override for this conflict.',
                    'La règle interdit une dérogation pour ce conflit.',
                  )
            }
          >
            {isCollisionExpired(event)
              ? l(
                  'Re-attempt the contact to get a fresh decision from the engine.',
                  'Réessayez le contact pour obtenir une nouvelle décision du moteur.',
                )
              : l(
                  'The reservation rule in force when this was detected does not allow a manager override.',
                  'La règle de réservation en vigueur lors de la détection n’autorise pas la dérogation d’un manager.',
                )}
          </Alert>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <dt className="min-w-32 text-[13px] font-semibold text-ink-muted">{label}</dt>

      <dd className="min-w-0 flex-1 text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function formatTimestamp(value: string, locale?: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function describeCollisionError(error: unknown, language: string): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'You are not authorized to act on this collision.',
      'Vous n’êtes pas autorisé à agir sur cette collision.',
    );
  }

  if (error.statusCode === 409) {
    return l(
      'This collision changed. Reload before requesting an override.',
      'Cette collision a changé. Rechargez avant de demander une dérogation.',
    );
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return l(
    'We could not load collision events. Please try again.',
    'Impossible de charger les événements anti-collision. Réessayez.',
  );
}

function decisionText(decision: CollisionDecision, language: string): string {
  if (language !== 'fr') return decisionLabel(decision);
  return {
    allow: 'Autorisé',
    block: 'Bloqué',
    warn: 'Averti',
    require_override: 'Dérogation requise',
  }[decision];
}

function reasonText(code: CollisionReasonCode, language: string): string {
  if (language !== 'fr') return reasonLabel(code);
  return {
    NO_COLLISION: 'Aucune collision',
    ACTIVE_RESERVATION: 'Réservation active',
    ACTIVE_ASSIGNMENT: 'Attribution active',
    PLANNED_ACTION: 'Action planifiée',
    RECENT_CONTACT: 'Contact récent',
  }[code];
}
