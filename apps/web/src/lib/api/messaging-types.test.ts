import { describe, expect, it } from 'vitest';

import {
  conversationName,
  hasUnread,
  isMuted,
  muteUntil,
  type Conversation,
  type ConversationParticipant,
} from './messaging-types';

const NOW = Date.parse('2026-09-23T12:00:00.000Z');

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    tenantId: 't1',
    kind: 'direct',
    title: null,
    status: 'active',
    createdBy: 'm1',
    createdAt: '2026-09-23T10:00:00.000Z',
    updatedAt: '2026-09-23T11:00:00.000Z',
    ...overrides,
  };
}

function participant(overrides: Partial<ConversationParticipant> = {}): ConversationParticipant {
  return {
    id: 'p1',
    tenantId: 't1',
    conversationId: 'c1',
    membershipId: 'm1',
    lastReadAt: null,
    mutedUntil: null,
    joinedAt: '2026-09-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('conversationName', () => {
  it('prefers an explicit title', () => {
    expect(conversationName(conversation({ title: 'Verdun daily' }), ['A', 'B'])).toBe(
      'Verdun daily',
    );
  });

  /* Direct conversations usually carry no title. */
  it('falls back to the other participants', () => {
    expect(conversationName(conversation(), ['Sophie', 'Laurent'])).toBe('Sophie, Laurent');
  });

  it('caps the fallback at three names', () => {
    expect(conversationName(conversation(), ['A', 'B', 'C', 'D'])).toBe('A, B, C');
  });

  it('never renders a bare id when there is nothing else', () => {
    expect(conversationName(conversation({ kind: 'team' }), [])).toBe('Team conversation');
  });

  it('ignores a whitespace-only title', () => {
    expect(conversationName(conversation({ title: '   ' }), ['Sophie'])).toBe('Sophie');
  });
});

describe('isMuted', () => {
  it('is false when no mute is set', () => {
    expect(isMuted(participant(), NOW)).toBe(false);
  });

  it('is true while the mute window is open', () => {
    expect(isMuted(participant({ mutedUntil: '2026-09-23T13:00:00.000Z' }), NOW)).toBe(true);
  });

  /* An expired mute must not keep the conversation silent. */
  it('is false once the mute has lapsed', () => {
    expect(isMuted(participant({ mutedUntil: '2026-09-23T11:00:00.000Z' }), NOW)).toBe(false);
  });

  it('does not treat an unparseable value as muted', () => {
    expect(isMuted(participant({ mutedUntil: 'soon' }), NOW)).toBe(false);
  });
});

describe('hasUnread', () => {
  it('is true before the viewer has ever opened it', () => {
    expect(hasUnread(conversation(), participant())).toBe(true);
  });

  it('is true when activity arrived after the last read', () => {
    expect(
      hasUnread(
        conversation({ updatedAt: '2026-09-23T11:30:00.000Z' }),
        participant({ lastReadAt: '2026-09-23T11:00:00.000Z' }),
      ),
    ).toBe(true);
  });

  it('is false when the viewer has read past the last activity', () => {
    expect(
      hasUnread(
        conversation({ updatedAt: '2026-09-23T11:00:00.000Z' }),
        participant({ lastReadAt: '2026-09-23T11:30:00.000Z' }),
      ),
    ).toBe(false);
  });

  /* Someone who is not a participant has nothing to have read. */
  it('is false when the viewer is not a participant', () => {
    expect(hasUnread(conversation(), undefined)).toBe(false);
  });
});

describe('muteUntil', () => {
  /* The API rejects a bare local time, so the value must carry Z. */
  it('produces an instant the API will accept', () => {
    expect(muteUntil(8, NOW)).toBe('2026-09-23T20:00:00.000Z');
  });
});
