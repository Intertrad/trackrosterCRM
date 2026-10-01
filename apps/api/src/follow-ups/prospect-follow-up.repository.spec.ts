import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Database } from '../database/database.types.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';

describe('follow-up queue completed filter', () => {
  it.each([false, true])(
    'includes completed only when requested (%s) without widening ownership',
    async (includeCompleted) => {
      const builder = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      const repository = new ProspectFollowUpRepository({
        select: vi.fn(() => builder),
      } as unknown as Database);
      await repository.findActionableQueue('tenant', {
        userId: 'caller',
        teamScopes: [{ organizationId: 'org', teamId: 'team' }],
        now: new Date(),
        limit: 100,
        includeCompleted,
      });
      const query = new PgDialect().sqlToQuery(builder.where.mock.calls[0]![0]);
      expect(query.params).toEqual(
        expect.arrayContaining(['tenant', 'pending', 'org', 'team', 'caller']),
      );
      expect(query.params.includes('completed')).toBe(includeCompleted);
      expect(query.params).not.toContain('cancelled');
      expect(query.params.filter((value) => value === 'caller')).toHaveLength(2);
    },
  );
});
