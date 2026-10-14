import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import type { AuthMailService } from '../auth/auth-mail.service.js';
import type { Database } from '../database/database.types.js';
import { ScriptService } from './script.service.js';

const { executor } = vi.hoisted(() => ({ executor: { select: vi.fn() } }));
vi.mock('../database/request-tenant-executor.js', () => ({
  currentTenantExecutor: () => executor,
}));

const auth = { tenantId: 'tenant', membershipId: 'member' } as AuthenticatedPrincipal;

describe('previous template preview', () => {
  beforeEach(() => vi.clearAllMocks());

  function setup(events: Array<{ metadata: Record<string, unknown> }>) {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(events),
    };
    executor.select.mockReturnValue(query);
    const service = new ScriptService({} as Database, {} as AuthMailService);
    vi.spyOn(service, 'get').mockResolvedValue({ body: 'Current content' } as Awaited<
      ReturnType<ScriptService['get']>
    >);
    return { service, query };
  }

  it('renders the saved before snapshot instead of the current content', async () => {
    const { service, query } = setup([
      {
        metadata: {
          before: { subject: 'Old subject', body: 'Hello {{name}}', variables: ['name'] },
        },
      },
    ]);
    await expect(service.previousPreview(auth, 'script', { name: 'Alice' })).resolves.toEqual({
      subject: 'Old subject',
      body: 'Hello Alice',
      missingVariables: [],
    });
    expect(service.get).toHaveBeenCalledWith(auth, 'script', executor);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it('reports no previous version without substituting current content', async () => {
    const { service } = setup([]);
    await expect(service.previousPreview(auth, 'script', {})).resolves.toBeNull();
  });

  it('propagates missing variables from the previous version', async () => {
    const { service } = setup([
      { metadata: { before: { body: '{{old_variable}}', variables: ['old_variable'] } } },
    ]);
    expect((await service.previousPreview(auth, 'script', {}))?.missingVariables).toEqual([
      'old_variable',
    ]);
  });

  it('does not read history for a script unavailable to the caller', async () => {
    const { service } = setup([]);
    vi.mocked(service.get).mockRejectedValue(new Error('Script not found'));
    await expect(service.previousPreview(auth, 'script', {})).rejects.toThrow('Script not found');
    expect(executor.select).not.toHaveBeenCalled();
  });
});
