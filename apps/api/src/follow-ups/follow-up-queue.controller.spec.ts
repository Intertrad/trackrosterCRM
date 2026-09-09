import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FollowUpQueueController } from './follow-up-queue.controller.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';

describe('FollowUpQueueController', () => {
  let queryService: {
    listQueue: ReturnType<typeof vi.fn>;
  };

  let controller: FollowUpQueueController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

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

  it('passes authenticated identity and queue filters to the query service', async () => {
    await controller.list(
      {
        tenantId,

        userId,
      },

      {
        overdue: true,

        limit: 25,
      },
    );

    expect(queryService.listQueue).toHaveBeenCalledWith({
      tenantId,

      userId,

      overdue: true,

      limit: 25,
    });
  });

  it('passes default query values', async () => {
    await controller.list(
      {
        tenantId,

        userId,
      },

      {
        limit: 50,
      },
    );

    expect(queryService.listQueue).toHaveBeenCalledWith({
      tenantId,

      userId,

      overdue: undefined,

      limit: 50,
    });
  });
});
