import { browserJson } from './browser-json';
import type {
  Conversation,
  ConversationKind,
  ConversationPage,
  ConversationParticipant,
  Message,
  MessagePage,
} from './messaging-types';

function writeHeaders(): Record<string, string> {
  return { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() };
}

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  return search.toString();
}

export function listConversations(
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ConversationPage> {
  const search = query(options);

  return browserJson<ConversationPage>(
    search ? `/api/conversations?${search}` : '/api/conversations',
    { cache: 'no-store', signal },
  );
}

export function createConversation(input: {
  kind: ConversationKind;
  title?: string;
  participantIds?: string[];
}): Promise<Conversation> {
  return browserJson<Conversation>('/api/conversations', {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function getConversation(
  conversationId: string,
  signal?: AbortSignal,
): Promise<Conversation> {
  return browserJson<Conversation>(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function updateConversation(
  conversationId: string,
  input: { title?: string; status?: 'active' | 'archived' },
): Promise<Conversation> {
  return browserJson<Conversation>(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function listParticipants(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationParticipant[]> {
  return browserJson<ConversationParticipant[]>(
    `/api/conversations/${encodeURIComponent(conversationId)}/participants`,
    { cache: 'no-store', signal },
  );
}

export function addParticipant(conversationId: string, membershipId: string): Promise<unknown> {
  return browserJson<unknown>(
    `/api/conversations/${encodeURIComponent(conversationId)}/participants`,
    { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ membershipId }) },
  );
}

export function removeParticipant(conversationId: string, membershipId: string): Promise<void> {
  return browserJson<void>(
    `/api/conversations/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(membershipId)}`,
    { method: 'DELETE', headers: writeHeaders() },
  );
}

export function listMessages(
  conversationId: string,
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<MessagePage> {
  const search = query(options);
  const path = `/api/conversations/${encodeURIComponent(conversationId)}/messages`;

  return browserJson<MessagePage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return browserJson<Message>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify({ body }),
  });
}

/** Only the sender may edit, and only while the message is still `sent`. */
export function editMessage(messageId: string, body: string): Promise<Message> {
  return browserJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: writeHeaders(),
    body: JSON.stringify({ body }),
  });
}

/* A delete is a tombstone upstream: the row stays, its body is cleared. */
export function deleteMessage(messageId: string): Promise<void> {
  return browserJson<void>(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  });
}

export function markConversationRead(conversationId: string): Promise<unknown> {
  return browserJson<unknown>(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
    headers: writeHeaders(),
    body: '{}',
  });
}

export function muteConversation(
  conversationId: string,
  mutedUntil: string | null,
): Promise<unknown> {
  return browserJson<unknown>(`/api/conversations/${encodeURIComponent(conversationId)}/mute`, {
    method: 'PATCH',
    headers: writeHeaders(),
    body: JSON.stringify({ mutedUntil }),
  });
}
