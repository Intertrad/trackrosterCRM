import { ForbiddenException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import type { Database } from '../database/database.types.js';
import { MessagingService } from './messaging.module.js';

const auth = { tenantId: 'tenant-a', membershipId: 'member-a' } as AuthenticatedPrincipal;

function fixture(returned: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returned);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return {
    service: new MessagingService({ update } as unknown as Database),
    where,
  };
}

describe('message mutability', () => {
  it('allows an edit while no other participant has read the message', async () => {
    const message = { id: 'message', status: 'edited', body: 'updated' };
    const { service, where } = fixture([message]);

    await expect(service.edit(auth, 'message', 'updated')).resolves.toEqual(message);

    const query = new PgDialect().sqlToQuery(where.mock.calls[0]![0]);
    expect(query.sql.toLowerCase()).toContain('not exists');
    expect(query.sql).toContain('last_read_at');
  });

  it('rejects edits after another participant has read the message', async () => {
    const { service } = fixture([]);

    await expect(service.edit(auth, 'message', 'updated')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects deletes after another participant has read the message', async () => {
    const { service } = fixture([]);

    await expect(service.remove(auth, 'message')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
