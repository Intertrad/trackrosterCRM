import type { MessageKey } from '@/lib/i18n/dictionary';
import type { Translate } from '@/lib/i18n/i18n-context';

export type ConversationKind = 'direct' | 'team' | 'prospect' | 'campaign';

export type ConversationStatus = 'active' | 'archived';

export type MessageStatus = 'sent' | 'edited' | 'deleted';

export interface Conversation {
  id: string;
  tenantId: string;
  kind: ConversationKind;
  title: string | null;
  status: ConversationStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  latestMessage?: {
    id: string;
    body: string;
    status: MessageStatus;
    createdAt: string;
    sender: MessagingMember | null;
  } | null;
  context?: {
    establishment: string;
    location?: string;
    action?: string;
    outcome?: string;
  } | null;
}

export interface ConversationParticipant {
  id: string;
  tenantId: string;
  conversationId: string;
  membershipId: string;
  lastReadAt: string | null;
  mutedUntil: string | null;
  joinedAt: string;
  displayName?: string | null;
  email?: string;
  roles?: string[];
  designation?: string;
}

export interface MessagingMember {
  membershipId: string;
  displayName: string | null;
  email: string;
  roles: string[];
  designation: string;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
}
export interface Message {
  attachments?: MessageAttachment[];
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  sender?: MessagingMember | null;
}

/**
 * Both listings page on a composite `<iso>|<uuid>` cursor.
 *
 * They are ordered by (timestamp DESC, id DESC), so the cursor has to carry
 * both halves of the sort key — an id-only cursor returns an arbitrary subset
 * rather than the next page.
 */
export interface ConversationPage {
  items: Conversation[];
  nextCursor: string | null;
}

export interface MessagePage {
  items: Message[];
  nextCursor: string | null;
}

/** The message body column is unbounded text; the API caps it here. */
export const MAX_MESSAGE_BODY = 10_000;

export const MAX_CONVERSATION_TITLE = 200;

export const CONVERSATION_KINDS: readonly ConversationKind[] = [
  'direct',
  'team',
  'prospect',
  'campaign',
];

const KIND_LABELS: Record<ConversationKind, MessageKey> = {
  direct: 'conversation.direct',
  team: 'conversation.team',
  prospect: 'conversation.prospect',
  campaign: 'conversation.campaign',
};

/** The message key for a kind; call sites translate it themselves. */
export function conversationKindLabelKey(kind: ConversationKind): MessageKey {
  return KIND_LABELS[kind];
}

/**
 * A readable name for a conversation that may not have a title.
 *
 * Direct conversations usually carry none, so the other participants' names
 * stand in — falling back to the kind rather than showing a bare id.
 */
export function conversationName(
  conversation: Conversation,
  t: Translate,
  participantNames: string[] = [],
): string {
  if (conversation.title?.trim()) {
    return conversation.title.trim();
  }

  if (participantNames.length > 0) {
    return participantNames.slice(0, 3).join(', ');
  }

  return t('conversation.named', { kind: t(conversationKindLabelKey(conversation.kind)) });
}

export function isMuted(
  participant: ConversationParticipant | undefined,
  now: number = Date.now(),
): boolean {
  if (!participant?.mutedUntil) {
    return false;
  }

  const until = new Date(participant.mutedUntil).getTime();

  return Number.isNaN(until) ? false : until > now;
}

/**
 * Whether the conversation holds anything the viewer has not seen.
 *
 * `lastReadAt` is null until the viewer opens it once, which counts as unread
 * only if a message actually exists.
 */
export function hasUnread(
  conversation: Conversation,
  participant: ConversationParticipant | undefined,
): boolean {
  if (!participant) {
    return false;
  }

  if (!participant.lastReadAt) {
    return true;
  }

  const read = new Date(participant.lastReadAt).getTime();
  const updated = new Date(conversation.updatedAt).getTime();

  return Number.isNaN(read) || Number.isNaN(updated) ? false : updated > read;
}

/** The API only accepts an instant carrying an explicit offset or Z. */
export function muteUntil(hours: number, from: number = Date.now()): string {
  return new Date(from + hours * 3600_000).toISOString();
}
