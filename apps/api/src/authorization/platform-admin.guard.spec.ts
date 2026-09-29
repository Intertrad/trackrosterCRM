import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PlatformAdminGuard } from './platform-admin.guard.js';

function context(auth?: { identityId: string }) {
  return { switchToHttp: () => ({ getRequest: () => ({ auth }) }) } as never;
}

describe('PlatformAdminGuard', () => {
  it('allows only an active super administrator grant', async () => {
    const where = vi.fn().mockResolvedValue([{ role: 'super_admin' }]);
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: where }) }) }) } as never;
    await expect(
      new PlatformAdminGuard(db).canActivate(context({ identityId: 'i' })),
    ).resolves.toBe(true);
  });

  it('rejects support operators', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: where }) }) }) } as never;
    await expect(
      new PlatformAdminGuard(db).canActivate(context({ identityId: 'i' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
