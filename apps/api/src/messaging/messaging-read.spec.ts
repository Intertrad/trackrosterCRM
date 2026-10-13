import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { MessagingService } from './messaging.module.js';
import type { Database } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
const auth = { tenantId: 'tenant', membershipId: 'viewer' } as AuthenticatedPrincipal;
function fixture(member = true, message = true) {
  const where = vi
    .fn()
    .mockResolvedValueOnce(member ? [{ id: 'participant' }] : [])
    .mockResolvedValueOnce(message ? [{ id: 'visible-message' }] : []);
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  const db = {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    update: vi.fn().mockReturnValue({ set }),
  };
  return { service: new MessagingService(db as unknown as Database), set };
}
describe('conversation read cursor', () => {
  it('limits reading to the displayed message and never moves the cursor backward', async () => {
    const { service, set } = fixture();
    await service.read(auth, 'conversation', 'visible-message');
    const query = new PgDialect().sqlToQuery(set.mock.calls[0]![0].lastReadAt);
    expect(query.sql).toContain('greatest(');
    expect(query.sql).not.toContain('clock_timestamp');
    expect(query.params).toEqual(['tenant', 'conversation', 'visible-message']);
  });
  it('rejects a message outside the authorized conversation', async () => {
    const { service, set } = fixture(true, false);
    await expect(service.read(auth, 'conversation', 'foreign-message')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(set).not.toHaveBeenCalled();
  });
  it('rejects a nonparticipant before changing read state', async () => {
    const { service, set } = fixture(false);
    await expect(service.read(auth, 'conversation', 'visible-message')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(set).not.toHaveBeenCalled();
  });
});
