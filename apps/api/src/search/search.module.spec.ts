import { describe, expect, it, vi } from 'vitest';
import { SearchService, SearchQuery } from './search.module.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const method of ['select', 'from', 'where', 'orderBy', 'limit']) c[method] = vi.fn(() => c);
  c.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(rows));
  return c;
}

describe('SearchService', () => {
  it('rejects queries shorter than two characters', async () => {
    const service = new SearchService({} as never);
    await expect(service.search({ tenantId }, { q: 'a' } as SearchQuery)).rejects.toThrow(
      'at least 2 characters',
    );
  });

  it('merges tenant-scoped entity results into a bounded page', async () => {
    const db = {
      select: vi.fn(() =>
        chain([{ id: '1', title: 'Acme', subtitle: null, updatedAt: new Date() }]),
      ),
    };
    const service = new SearchService(db as never);
    const result = await service.search({ tenantId }, { q: 'acme', type: 'organization' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.type).toBe('organization');
    expect(db.select).toHaveBeenCalled();
  });
});
