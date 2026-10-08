import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FollowUpQueueController } from './follow-up-queue.controller.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';
import type { CanonicalFollowUpService } from './canonical-follow-up.service.js';

describe('FollowUpQueueController', () => {
  let queryService: {
    listQueue: ReturnType<typeof vi.fn>;
  };

  let controller: FollowUpQueueController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    queryService = {
      listQueue: vi.fn().mockResolvedValue({
        items: [],
      }),
    };

    controller = new FollowUpQueueController(
      queryService as unknown as ProspectFollowUpQueryService,
    );
  });

  it('passes authenticated identity, selected team, and queue filters to the query service', async () => {
    await controller.list(
      {
        tenantId,

        userId,
      },

      {
        teamId,

        overdue: true,

        limit: 25,
      },
    );

    expect(queryService.listQueue).toHaveBeenCalledWith({
      tenantId,

      userId,

      teamId,

      overdue: true,

      limit: 25,
    });
  });

  it('passes selected team with default query values', async () => {
    await controller.list(
      {
        tenantId,

        userId,
      },

      {
        teamId,

        limit: 50,
      },
    );

    expect(queryService.listQueue).toHaveBeenCalledWith({
      tenantId,

      userId,

      teamId,

      overdue: undefined,

      limit: 50,
    });
  });

  it('uses the canonical queue for a selected team when it is available', async () => {
    const canonical = {
      list: vi.fn().mockResolvedValue({ items: [] }),
    };
    const canonicalController = new FollowUpQueueController(
      queryService as unknown as ProspectFollowUpQueryService,
      canonical as unknown as CanonicalFollowUpService,
    );

    const query = { teamId, overdue: true, limit: 25 };

    await canonicalController.list({ tenantId, userId }, query);

    expect(canonical.list).toHaveBeenCalledWith({ tenantId, userId }, query);
    expect(queryService.listQueue).not.toHaveBeenCalled();
  });
});
