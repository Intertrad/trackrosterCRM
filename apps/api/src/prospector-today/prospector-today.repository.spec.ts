import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { Database } from '../database/database.types.js';
import { PRIORITY_LIMIT, ProspectorTodayRepository } from './prospector-today.repository.js';

type QueryBuilder = Record<string, ReturnType<typeof vi.fn>> & {
  then: Promise<unknown[]>['then'];
};

function createQueryBuilder(result: unknown[]): QueryBuilder {
  const builder = {} as QueryBuilder;

  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }

  builder.then = Promise.resolve(result).then.bind(Promise.resolve(result));

  return builder;
}

describe('ProspectorTodayRepository', () => {
  let select: ReturnType<typeof vi.fn>;
  let summaryBuilder: QueryBuilder;
  let priorityBuilder: QueryBuilder;
  let completedBuilder: QueryBuilder;
  let completedRowsBuilder: QueryBuilder;
  let repository: ProspectorTodayRepository;

  beforeEach(() => {
    summaryBuilder = createQueryBuilder([
      {
        actionsLeft: 40,
        toDo: 12,
        followUps: 10,
        meetings: 8,
        overdue: 10,
      },
    ]);

    priorityBuilder = createQueryBuilder([
      {
        id: '11111111-1111-4111-8111-111111111111',
        campaignId: '22222222-2222-4222-8222-222222222222',
        campaignProspectId: '33333333-3333-4333-8333-333333333333',
        dueAt: new Date('2026-09-20T09:00:00.000Z'),
        category: 'follow_up',
        channel: 'call',
        establishment: {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Nancy central police station',
          city: 'Nancy',
          latitude: '48.6921',
          longitude: '6.1844',
        },
      },
    ]);

    /* Completed work is counted by its own query: the shared scope condition
     * pins status to 'pending', so it cannot come from the summary. */
    completedBuilder = createQueryBuilder([{ completedToday: 12 }]);

    completedRowsBuilder = createQueryBuilder([]);
    select = vi
      .fn()
      .mockReturnValueOnce(summaryBuilder)
      .mockReturnValueOnce(priorityBuilder)
      .mockReturnValueOnce(completedBuilder)
      .mockReturnValueOnce(completedRowsBuilder);

    repository = new ProspectorTodayRepository({
      select,
    } as unknown as Database);
  });

  it('keeps the aggregate uncapped while limiting only ordered priorities', async () => {
    await expect(
      repository.findToday({
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        now: new Date('2026-09-20T10:00:00.000Z'),
        startsAt: new Date(Date.parse('2026-09-21T00:00:00.000Z')),
        endsAt: new Date('2026-09-20T22:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      summary: {
        actionsLeft: 40,
      },
      priorities: [
        {
          category: 'follow_up',
          channel: 'call',
        },
      ],
    });

    expect(summaryBuilder.limit).not.toHaveBeenCalled();
    expect(priorityBuilder.orderBy).toHaveBeenCalledTimes(1);
    expect(priorityBuilder.limit).toHaveBeenCalledWith(PRIORITY_LIMIT);
    expect(summaryBuilder.where).toHaveBeenCalledTimes(1);
    expect(priorityBuilder.where).toHaveBeenCalledTimes(1);
  });

  it('returns a zero summary if the database adapter yields no aggregate row', async () => {
    summaryBuilder = createQueryBuilder([]);
    priorityBuilder = createQueryBuilder([]);
    completedBuilder = createQueryBuilder([]);
    completedRowsBuilder = createQueryBuilder([]);
    select = vi
      .fn()
      .mockReturnValueOnce(summaryBuilder)
      .mockReturnValueOnce(priorityBuilder)
      .mockReturnValueOnce(completedBuilder)
      .mockReturnValueOnce(completedRowsBuilder);
    repository = new ProspectorTodayRepository({
      select,
    } as unknown as Database);

    await expect(
      repository.findToday({
        tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        now: new Date('2026-09-20T10:00:00.000Z'),
        startsAt: new Date(Date.parse('2026-09-21T00:00:00.000Z')),
        endsAt: new Date('2026-09-20T22:00:00.000Z'),
      }),
    ).resolves.toEqual({
      summary: {
        actionsLeft: 0,
        toDo: 0,
        followUps: 0,
        meetings: 0,
        overdue: 0,
        /* An empty aggregate still reports a real completed count. */
        completedToday: 0,
      },
      priorities: [],
      completed: [],
    });
  });

  it('requires both assignment and follow-up ownership to be caller or team-owned', async () => {
    const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    await repository.findToday({
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId,
      now: new Date('2026-09-20T10:00:00.000Z'),
      startsAt: new Date(Date.parse('2026-09-21T00:00:00.000Z')),
      endsAt: new Date('2026-09-20T22:00:00.000Z'),
    });

    const condition = summaryBuilder.where!.mock.calls[0]?.[0];

    expect(condition).toBeDefined();

    const compiled = new PgDialect().sqlToQuery(condition);

    expect(compiled.sql).toContain('"campaign_prospect_assignments"."assigned_user_id"');
    expect(compiled.sql).toContain('"prospect_follow_ups"."assigned_user_id"');
    expect(compiled.params.filter((parameter) => parameter === userId)).toHaveLength(2);
  });
  it('uses completion day boundaries and workspace ownership for both count and rows', async () => {
    const startsAt = new Date('2026-09-19T22:00:00Z');
    const endsAt = new Date('2026-09-20T22:00:00Z');
    const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await repository.findToday({
      tenantId: 'tenant',
      organizationId: 'org',
      teamId: 'team',
      userId,
      startsAt,
      endsAt,
      now: new Date('2026-09-20T10:00:00Z'),
    });
    const condition = completedRowsBuilder.where!.mock.calls[0]![0];
    expect(condition).toBe(completedBuilder.where!.mock.calls[0]![0]);
    const query = new PgDialect().sqlToQuery(condition);
    expect(query.sql).toContain('"completed_at" >=');
    expect(query.sql).toContain('"completed_at" <');
    expect(query.params).toEqual(
      expect.arrayContaining([
        startsAt.toISOString(),
        endsAt.toISOString(),
        'completed',
        'tenant',
        'org',
        'team',
      ]),
    );
    expect(query.params.filter((value) => value === userId)).toHaveLength(2);
    expect(completedRowsBuilder.limit).toHaveBeenCalledWith(100);
    expect(completedBuilder.limit).not.toHaveBeenCalled();
    const order = completedRowsBuilder.orderBy!.mock.calls[0]![0];
    expect(new PgDialect().sqlToQuery(order).sql).toContain('"completed_at" desc');
  });
});
