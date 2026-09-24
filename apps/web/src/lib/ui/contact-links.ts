import type { ProspectorTodayChannel } from '@/lib/api/prospector-today-types';

/**
 * Handing an action off to the device.
 *
 * A call belongs in the phone app and an email in the mail client: the
 * prospector is holding a phone, and retyping a number from the screen is
 * both slower and a way to dial the wrong business.
 *
 * Visits deliberately stay in the product. Opening a third-party maps app
 * would send a customer's coordinates to someone else's servers, which is the
 * opposite of why this deployment self-hosts its tiles — so a visit opens the
 * prospect and its own map instead.
 */
export type LaunchableChannel = 'call' | 'email';

export function isLaunchable(channel: ProspectorTodayChannel | null): channel is LaunchableChannel {
  return channel === 'call' || channel === 'email';
}

/**
 * The `tel:` or `mailto:` target, or null when the record cannot support it.
 *
 * A button that opens an empty dialler is worse than no button, so a missing
 * number or address means no launch.
 */
export function contactHref(
  channel: ProspectorTodayChannel | null,
  contact: { phone?: string | null; email?: string | null },
): string | null {
  if (channel === 'call') {
    const phone = contact.phone?.trim();

    /* `tel:` tolerates spacing, but strips are safer across dialler apps. */
    return phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  }

  if (channel === 'email') {
    const email = contact.email?.trim();

    return email ? `mailto:${email}` : null;
  }

  return null;
}
