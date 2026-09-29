'use client';
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react';

import type { ProspectCollisionDecision } from '@/lib/api/work-queue-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { cn } from '@/lib/ui/cn';

/*
 * The dossier's decision tree in one component: a prospector must never have
 * to wonder whether they are allowed to contact a prospect. The banner states
 * the server's decision and the reason, and is never dismissible.
 */
const REASONS: Record<ProspectCollisionDecision['reasonCode'], string> = {
  NO_COLLISION: 'No collision detected.',
  ACTIVE_ASSIGNMENT: 'This prospect is owned by another active assignment.',
  ACTIVE_RESERVATION: 'Another team member is contacting this prospect right now.',
  PLANNED_ACTION: 'A conflicting action is already planned for this prospect.',
  RECENT_CONTACT: 'This prospect was contacted too recently.',
};

const REASONS_FR: typeof REASONS = {
  NO_COLLISION: 'Aucun conflit détecté.',
  ACTIVE_ASSIGNMENT: 'Cet établissement appartient à une autre attribution active.',
  ACTIVE_RESERVATION: 'Un autre membre contacte cet établissement en ce moment.',
  PLANNED_ACTION: 'Une action incompatible est déjà prévue pour cet établissement.',
  RECENT_CONTACT: 'Cet établissement a été contacté trop récemment.',
};

const DECISIONS = {
  allow: {
    title: 'Contact allowed',
    fr: 'Contact autorisé',
    tone: 'border-success-border bg-success-bg',
    icon: CircleCheck,
    iconTone: 'text-success',
  },
  warn: {
    title: 'Proceed with care',
    fr: 'Prudence requise',
    tone: 'border-warning-border bg-warning-bg',
    icon: TriangleAlert,
    iconTone: 'text-warning',
  },
  require_override: {
    title: 'Manager validation required',
    fr: 'Validation du responsable requise',
    tone: 'border-warning-border bg-warning-bg',
    icon: ShieldAlert,
    iconTone: 'text-warning',
  },
  block: {
    title: 'Contact blocked',
    fr: 'Contact bloqué',
    tone: 'border-danger-border bg-danger-bg',
    icon: ShieldAlert,
    iconTone: 'text-danger',
  },
} as const;

export function CollisionBanner({
  decision,
  className,
}: {
  decision: ProspectCollisionDecision;
  className?: string;
}) {
  const { language } = useTranslation();
  const config = DECISIONS[decision.decision];
  const Icon = config.icon;

  const blocking = decision.decision === 'block' || decision.decision === 'require_override';

  return (
    <div
      role={blocking ? 'alert' : 'status'}
      aria-live={blocking ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', config.tone, className)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', config.iconTone)} />

      <div className="min-w-0 text-[14px]">
        <p className="font-semibold text-navy">{text(config.title, config.fr, language)}</p>

        <p className="text-ink-soft">
          {(language === 'fr' ? REASONS_FR : REASONS)[decision.reasonCode]}
        </p>

        <CollisionDetail decision={decision} />
      </div>
    </div>
  );
}

function CollisionDetail({ decision }: { decision: ProspectCollisionDecision }) {
  const { language, locale } = useTranslation();
  const conflict = decision.conflict;

  if (!conflict) {
    return null;
  }

  if ('expiresAt' in conflict) {
    return (
      <p className="mt-1 text-ink-muted">
        {text('The current reservation expires at', 'La réservation en cours expire le', language)}{' '}
        {formatDateTime(conflict.expiresAt, locale)}.
      </p>
    );
  }

  if ('dueAt' in conflict) {
    return (
      <p className="mt-1 text-ink-muted">
        {text('The planned action is due at', 'L’action est prévue le', language)}{' '}
        {formatDateTime(conflict.dueAt, locale)}.
      </p>
    );
  }

  return (
    <p className="mt-1 text-ink-muted">
      {text('Assigned since', 'Attribué depuis le', language)}{' '}
      {formatDateTime(conflict.assignedAt, locale)}.
    </p>
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
