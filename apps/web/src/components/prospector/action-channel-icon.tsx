import { FileText, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import type { ProspectorTodayChannel } from '@/lib/api/prospector-today-types';
import type { MessageKey } from '@/lib/i18n/dictionary';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

/*
 * Channel colour is a functional code across the product: red for calls,
 * blue for written contact, green for on-site visits. Keeping it in one
 * component stops the palette drifting between Today, Actions and Routes.
 */
const CHANNELS = {
  call: { icon: Phone, tone: 'bg-danger text-white', label: 'channel.call' },
  email: { icon: Mail, tone: 'bg-brand text-white', label: 'channel.email' },
  message: { icon: MessageCircle, tone: 'bg-brand-mid text-white', label: 'channel.message' },
  visit: { icon: MapPin, tone: 'bg-success text-white', label: 'channel.visit' },
  letter: { icon: FileText, tone: 'bg-navy-700 text-white', label: 'channel.letter' },
} as const satisfies Record<
  ProspectorTodayChannel,
  { icon: typeof Phone; tone: string; label: MessageKey }
>;

const FALLBACK = {
  icon: FileText,
  tone: 'bg-surface-muted text-ink-muted',
  label: 'channel.action',
} as const satisfies { icon: typeof Phone; tone: string; label: MessageKey };

/** The message key for a channel; call sites translate it themselves. */
export function getChannelLabelKey(channel: ProspectorTodayChannel | null): MessageKey {
  return channel ? CHANNELS[channel].label : FALLBACK.label;
}

export function ActionChannelIcon({
  channel,
  className,
}: {
  channel: ProspectorTodayChannel | null;
  className?: string;
}) {
  const { t } = useTranslation();

  const config = channel ? CHANNELS[channel] : FALLBACK;
  const Icon = config.icon;

  return (
    <span
      role="img"
      aria-label={t(config.label)}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full',
        config.tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4.5" strokeWidth={2} />
    </span>
  );
}
