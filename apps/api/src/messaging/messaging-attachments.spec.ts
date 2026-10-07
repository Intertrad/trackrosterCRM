import { ForbiddenException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import type { Database } from '../database/database.types.js';
import {
  conversationParticipants,
  messages,
  messageReactions,
  messageAttachments,
  tenantMemberships,
} from '../database/schema/index.js';
import { MessagingService } from './messaging.module.js';

const auth = { tenantId: 'tenant-a', membershipId: 'member-a' } as AuthenticatedPrincipal;
function fixture(member = true) {
  const attachmentsWhere = vi.fn().mockResolvedValue([
    {
      id: 'attachment',
      messageId: 'message',
      filename: 'brief.pdf',
      contentType: 'application/pdf',
      byteSize: 120,
    },
  ]);
  const reactionsWhere = vi.fn().mockResolvedValue([]);
  let attachmentsProjection: unknown;
  const select = vi.fn((projection?: unknown) => ({
    from: (table: unknown) => {
      if (table === conversationParticipants)
        return { where: vi.fn().mockResolvedValue(member ? [{ id: 'participant' }] : []) };
      if (table === messageAttachments) {
        attachmentsProjection = projection;
        return { where: attachmentsWhere };
      }
      if (table === messageReactions) return { where: reactionsWhere };
      if (table === messages)
        return {
          where: () => ({
            orderBy: () => ({
              limit: async () => [
                { id: 'message', status: 'sent', createdAt: new Date('2026-01-01') },
                { id: 'deleted', status: 'deleted', createdAt: new Date('2026-01-01') },
              ],
            }),
          }),
        };
      if (table === tenantMemberships)
        return {
          innerJoin: () => ({
            where: vi.fn().mockResolvedValue([
              {
                membershipId: 'member-a',
                displayName: 'Member A',
                email: 'member-a@example.test',
                roles: ['prospector'],
              },
            ]),
            innerJoin: () => ({
              where: vi.fn().mockResolvedValue([
                {
                  membershipId: 'member-a',
                  displayName: 'Member A',
                  email: 'member-a@example.test',
                  roles: ['prospector'],
                },
              ]),
            }),
          }),
        };
      throw new Error(String(projection));
    },
  }));
  return {
    service: new MessagingService({ select } as unknown as Database),
    select,
    attachmentsWhere,
    attachmentsProjection: () => attachmentsProjection,
  };
}

describe('message attachment metadata', () => {
  it('batches only visible message attachments within the caller tenant and hides storage keys', async () => {
    const { service, attachmentsWhere, attachmentsProjection } = fixture();
    const result = await service.listMessages(auth, 'conversation', { limit: 100 });
    expect(result.items[0]?.attachments).toHaveLength(1);
    expect(result.items[1]?.attachments).toEqual([]);
    const query = new PgDialect().sqlToQuery(attachmentsWhere.mock.calls[0]![0]);
    expect(query.params).toEqual(['tenant-a', 'message']);
    expect(Object.keys(attachmentsProjection() as object)).toEqual([
      'id',
      'messageId',
      'filename',
      'contentType',
      'byteSize',
    ]);
  });
  it('denies non-participants before reading messages or attachments', async () => {
    const { service, select, attachmentsWhere } = fixture(false);
    await expect(service.listMessages(auth, 'conversation', { limit: 100 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(select).toHaveBeenCalledTimes(1);
    expect(attachmentsWhere).not.toHaveBeenCalled();
  });
});
