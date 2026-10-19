import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  conversationParticipants,
  conversations,
  messages,
  tenantMemberships,
} from '../database/schema/index.js';
import type { Database } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { MessagingService } from './messaging.module.js';
const auth = { tenantId: 'tenant', membershipId: 'viewer' } as AuthenticatedPrincipal;
function setup(authorized = true) {
  const where = vi.fn().mockReturnValue({ orderBy: () => ({ limit: async () => [] }) });
  const select = vi.fn(() => ({
    from: (table: unknown) => {
      if (table === conversationParticipants)
        return { where: async () => (authorized ? [{ id: 'member' }] : []) };
      if (table === messages) return { where };
      if (table === tenantMemberships) return { innerJoin: () => ({ where: async () => [] }) };
      throw new Error('Unexpected query');
    },
  }));
  return { service: new MessagingService({ select } as unknown as Database), where };
}
describe('conversation message search', () => {
  it('uses literal, case-insensitive matching scoped to tenant and conversation', async () => {
    const { service, where } = setup();
    await service.listMessages(auth, 'conversation', { search: 'a_%', limit: 50 });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0]![0]);
    expect(query.params).toContain('tenant');
    expect(query.params).toContain('conversation');
    expect(query.params).toContain('a_%');
    expect(query.sql).toContain('position(lower(');
    expect(query.sql).toContain("<> 'deleted'");
  });
  it('rejects nonparticipants before searching messages', async () => {
    const { service, where } = setup(false);
    await expect(
      service.listMessages(auth, 'conversation', { search: 'test', limit: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(where).not.toHaveBeenCalled();
  });
  it('searches all accessible conversations without dropping participant authorization', async () => {
    const where = vi.fn().mockReturnValue({ orderBy: () => ({ limit: async () => [] }) });
    const select = vi.fn(() => ({
      from: (table: unknown) => {
        expect(table).toBe(conversations);
        return { where };
      },
    }));
    const service = new MessagingService({ select } as unknown as Database);
    await service.list(auth, { search: 'hello', limit: 100 });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0]![0]);
    expect(query.params).toContain('tenant');
    expect(query.params).toContain('viewer');
    expect(query.params).toContain('hello');
    expect(query.sql).toContain('conversation_participants');
    expect(query.sql).toContain('sm.body');
  });
});
