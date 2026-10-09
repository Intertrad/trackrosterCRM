/**
 * Notification preferences.
 *
 * The stored column holds a map of channel objects only, so the six
 * categories below are the whole vocabulary the API accepts — digest cadence
 * and timezone would need a schema change, not a wider payload.
 */
export interface NotificationChannels {
  email?: boolean;
  push?: boolean;
  inApp?: boolean;
}

export const NOTIFICATION_CATEGORIES = [
  'assignments',
  'followUps',
  'collisions',
  'overrides',
  'messages',
  'imports',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = Partial<Record<NotificationCategory, NotificationChannels>>;

export const NOTIFICATION_CHANNELS = ['email', 'push', 'inApp'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export function isChannelRequired(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return category === 'collisions' && channel === 'inApp';
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  assignments: 'Assignments',
  followUps: 'Follow-ups',
  collisions: 'Collisions',
  overrides: 'Override requests',
  messages: 'Messages',
  imports: 'Imports',
};

const CATEGORY_LABELS_FR: Record<NotificationCategory, string> = {
  assignments: 'Attributions',
  followUps: 'Relances',
  collisions: 'Conflits',
  overrides: 'Demandes de dérogation',
  messages: 'Messages',
  imports: 'Imports',
};

const CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  assignments: 'A prospect is assigned to you, or moved away from you.',
  followUps: 'A follow-up you own becomes due or overdue.',
  collisions: 'The anti-collision engine blocks or warns on your contact.',
  overrides: 'An override request you raised is decided.',
  messages: 'A new message arrives in a conversation you are in.',
  imports: 'An import you started finishes or needs attention.',
};

const CATEGORY_DESCRIPTIONS_FR: Record<NotificationCategory, string> = {
  assignments: 'Un prospect vous est attribué ou vous est retiré.',
  followUps: 'Une relance dont vous êtes responsable arrive à échéance ou est en retard.',
  collisions: 'Le moteur anti-collision bloque ou signale votre contact.',
  overrides: 'Une demande de dérogation que vous avez créée est traitée.',
  messages: 'Un nouveau message arrive dans une conversation à laquelle vous participez.',
  imports: 'Un import que vous avez lancé se termine ou nécessite votre attention.',
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  push: 'Push',
  inApp: 'In app',
};

const CHANNEL_LABELS_FR: Record<NotificationChannel, string> = {
  email: 'E-mail',
  push: 'Push',
  inApp: 'Dans l’application',
};

export function categoryLabel(
  category: NotificationCategory,
  language: 'en' | 'fr' = 'en',
): string {
  return (language === 'fr' ? CATEGORY_LABELS_FR : CATEGORY_LABELS)[category];
}

export function categoryDescription(
  category: NotificationCategory,
  language: 'en' | 'fr' = 'en',
): string {
  return (language === 'fr' ? CATEGORY_DESCRIPTIONS_FR : CATEGORY_DESCRIPTIONS)[category];
}

export function channelLabel(channel: NotificationChannel, language: 'en' | 'fr' = 'en'): string {
  return (language === 'fr' ? CHANNEL_LABELS_FR : CHANNEL_LABELS)[channel];
}

/**
 * Whether a channel is on for a category.
 *
 * An absent entry means the preference has never been set, which the backend
 * treats as "not opted out" — so an unset channel reads as enabled rather
 * than silently off.
 */
export function isChannelEnabled(
  preferences: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  if (isChannelRequired(category, channel)) return true;

  return preferences[category]?.[channel] ?? true;
}

export function setChannel(
  preferences: NotificationPreferences,
  category: NotificationCategory,
  channel: NotificationChannel,
  enabled: boolean,
): NotificationPreferences {
  if (isChannelRequired(category, channel)) return preferences;

  return {
    ...preferences,
    [category]: { ...(preferences[category] ?? {}), [channel]: enabled },
  };
}

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface PushDevice {
  id: string;
  tenantId: string;
  membershipId: string;
  token: string;
  platform: DevicePlatform;
  lastSeenAt: string | null;
  revokedAt: string | null;
}
