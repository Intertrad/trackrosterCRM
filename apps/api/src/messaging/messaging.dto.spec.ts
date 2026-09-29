import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import {
  ConversationListDto,
  CreateConversationDto,
  MAX_MESSAGE_BODY,
  MuteConversationDto,
  SendMessageDto,
} from './messaging.dto.js';

/*
 * These assert the property the fix restores: that the global ValidationPipe
 * has a class to work against. Before this, every messaging @Body() was an
 * `any` or a type literal, which has no runtime metatype — Nest skipped
 * validation entirely and neither whitelist nor forbidNonWhitelisted applied.
 */
function check<T extends object>(cls: new () => T, payload: unknown) {
  return validateSync(plainToInstance(cls, payload) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateConversationDto', () => {
  it('accepts a well-formed conversation', () => {
    expect(
      check(CreateConversationDto, {
        kind: 'team',
        title: 'Verdun daily',
        participantIds: ['8f14e45f-ceea-4e6a-9f3a-1c2d3e4f5a6b'],
      }),
    ).toEqual([]);
  });

  it('rejects an unknown kind', () => {
    expect(check(CreateConversationDto, { kind: 'broadcast' })).not.toEqual([]);
  });

  it('rejects an unknown property rather than letting it through', () => {
    const errors = check(CreateConversationDto, { kind: 'team', createdBy: 'someone-else' });

    expect(errors.map((error) => error.property)).toContain('createdBy');
  });

  it('rejects a participant id that is not a UUID', () => {
    expect(
      check(CreateConversationDto, { kind: 'team', participantIds: ['not-a-uuid'] }),
    ).not.toEqual([]);
  });

  /* Unbounded fan-out would let one request add the whole tenant. */
  it('caps the participant list', () => {
    const many = Array.from(
      { length: 201 },
      (_value, index) => `8f14e45f-ceea-4e6a-9f3a-${String(index).padStart(12, '0')}`,
    );

    expect(check(CreateConversationDto, { kind: 'team', participantIds: many })).not.toEqual([]);
  });

  it('rejects a title longer than the column', () => {
    expect(check(CreateConversationDto, { kind: 'team', title: 'x'.repeat(201) })).not.toEqual([]);
  });
});

describe('SendMessageDto', () => {
  it('accepts a normal message', () => {
    expect(check(SendMessageDto, { body: 'On my way' })).toEqual([]);
  });

  it('rejects an empty body', () => {
    expect(check(SendMessageDto, { body: '' })).not.toEqual([]);
  });

  /* The column is unbounded `text`; the bound has to come from here. */
  it('rejects a body beyond the documented maximum', () => {
    expect(check(SendMessageDto, { body: 'x'.repeat(MAX_MESSAGE_BODY + 1) })).not.toEqual([]);
  });

  it('accepts a body exactly at the maximum', () => {
    expect(check(SendMessageDto, { body: 'x'.repeat(MAX_MESSAGE_BODY) })).toEqual([]);
  });
});

describe('MuteConversationDto', () => {
  it('accepts null to clear the mute', () => {
    expect(check(MuteConversationDto, { mutedUntil: null })).toEqual([]);
  });

  it('accepts an instant carrying an offset', () => {
    expect(check(MuteConversationDto, { mutedUntil: '2026-09-23T12:00:00.000Z' })).toEqual([]);
  });

  /* A bare local time previously reached new Date() and produced garbage. */
  it('rejects a timestamp with no offset', () => {
    expect(check(MuteConversationDto, { mutedUntil: '2026-09-23T12:00:00' })).not.toEqual([]);
  });

  it('rejects an unparseable value', () => {
    expect(check(MuteConversationDto, { mutedUntil: 'tomorrow' })).not.toEqual([]);
  });
});

describe('ConversationListDto', () => {
  it('accepts a composite cursor', () => {
    expect(
      check(ConversationListDto, {
        cursor: '2026-09-23T12:00:00.000Z|8f14e45f-ceea-4e6a-9f3a-1c2d3e4f5a6b',
      }),
    ).toEqual([]);
  });

  /* The old id-only cursor is exactly what produced wrong pages. */
  it('rejects a bare id cursor', () => {
    expect(
      check(ConversationListDto, { cursor: '8f14e45f-ceea-4e6a-9f3a-1c2d3e4f5a6b' }),
    ).not.toEqual([]);
  });

  it('rejects a limit beyond the page ceiling', () => {
    expect(check(ConversationListDto, { limit: 500 })).not.toEqual([]);
  });
});
