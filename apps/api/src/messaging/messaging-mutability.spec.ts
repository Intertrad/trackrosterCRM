import { ForbiddenException } from '@nestjs/common';
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
  it('rejects every edit after a message is sent', async () => {
    const { service, where } = fixture([{ id: 'message', status: 'sent', body: 'original' }]);

    await expect(service.edit(auth, 'message', 'updated')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(where).not.toHaveBeenCalled();
  });

  it('rejects deletes after another participant has read the message', async () => {
    const { service } = fixture([]);

    await expect(service.remove(auth, 'message')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
