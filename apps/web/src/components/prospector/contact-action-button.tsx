'use client';

import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';

import { LinkButton } from '@/components/ui/link-button';
import type { ProspectorTodayChannel } from '@/lib/api/prospector-today-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { contactHref, isLaunchable } from '@/lib/ui/contact-links';
import { cn } from '@/lib/ui/cn';

/**
 * Starts the action in the device's own app, then asks for the outcome.
 *
 * The dialler and the mail client are where the work actually happens; the
 * product's job is to hand off cleanly and then capture what came of it. The
 * prompt only appears once the hand-off has happened, so a row the prospector
 * never acted on is never asking to be closed.
 *
 * Falls back to opening the prospect when the channel cannot be launched or
 * the record has no number — an inert button would say the data is there.
 */
export function ContactActionButton({
  channel,
  phone,
  email,
  prospectHref,
  prospectName,
  onLogOutcome,
  className,
}: {
  channel: ProspectorTodayChannel | null;
  phone: string | null;
  email?: string | null;
  prospectHref: string;
  prospectName: string;
  onLogOutcome: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  const [launched, setLaunched] = useState(false);

  const href = isLaunchable(channel) ? contactHref(channel, { phone, email }) : null;

  if (!href) {
    return (
      <LinkButton href={prospectHref} className={className}>
        {t('today.viewProspect')}
      </LinkButton>
    );
  }

  if (launched) {
    return (
      <button
        type="button"
        onClick={onLogOutcome}
        className={cn(
          'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4',
          'bg-brand text-[15px] font-semibold text-white',
          'transition-colors duration-150 hover:bg-brand-hover',
          className,
        )}
      >
        {t('call.logNow')}
      </button>
    );
  }

  const Icon = channel === 'call' ? Phone : Mail;

  return (
    <a
      href={href}
      onClick={() => setLaunched(true)}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4',
        'bg-brand-wash text-[15px] font-semibold text-brand',
        'transition-colors duration-150 hover:bg-brand-tint',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />

      {channel === 'call' ? t('channel.call') : t('channel.email')}

      <span className="sr-only"> {prospectName}</span>
    </a>
  );
}
