import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { WorkQueueRepository, type FindWorkQueueInput } from './work-queue.repository.js';
import type {
  WorkQueueCursor,
  WorkQueueProspectDetail,
  WorkQueueResponse,
} from './work-queue.types.js';

const DEFAULT_LIMIT = 25;

export interface ListWorkQueueInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId?: string;

  search?: string;

  cursor?: string;

  limit?: number;
}

export interface GetWorkQueueProspectDetailInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId: string;

  campaignProspectId: string;
}

@Injectable()
export class WorkQueueService {
  constructor(
    private readonly authorizationService: AuthorizationService,

    private readonly workQueueRepository: WorkQueueRepository,
  ) {}

  async getProspectDetail(
    input: GetWorkQueueProspectDetailInput,
  ): Promise<WorkQueueProspectDetail> {
    /*
     * Authorization must happen before resolving the
     * requested prospect.
     *
     * A caller without the requested Prospector team
     * authority receives 403 without learning whether
     * the target resource exists.
     */
    await this.requireProspectorWorkspaceAccess(input.tenantId, input.userId, input.teamId);

    /*
     * The repository query itself is scoped by:
     *
     * - tenant
     * - authenticated user
     * - requested team
     * - campaign
     * - campaign prospect
     * - current assignment
     * - active campaign
     * - active campaign prospect
     *
     * Therefore a missing row also covers resources
     * outside the caller's active Work Queue boundary.
     */
    const detail = await this.workQueueRepository.findAssignedProspectById({
      tenantId: input.tenantId,

      userId: input.userId,

      teamId: input.teamId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    /*
     * Do not distinguish between:
     *
     * - missing campaign
     * - missing campaign prospect
     * - prospect assigned to another user
     * - prospect belonging to another team
     * - ended assignment
     * - inactive campaign
     * - inactive/excluded prospect
     *
     * All of these are outside this Work Queue detail
     * boundary and therefore use the same masked 404.
     */
    if (!detail) {
      throw new NotFoundException('Work queue prospect not found');
    }

    return detail;
  }

  async list(input: ListWorkQueueInput): Promise<WorkQueueResponse> {
    /*
     * Authorization is derived from durable backend
     * access grants.
     *
     * teamId comes from the browser only as the
     * requested workspace. It is never trusted by
     * itself.
     */
    await this.requireProspectorWorkspaceAccess(input.tenantId, input.userId, input.teamId);

    const limit = input.limit ?? DEFAULT_LIMIT;

    const cursor = input.cursor ? this.decodeCursor(input.cursor) : undefined;

    const repositoryInput: FindWorkQueueInput = {
      tenantId: input.tenantId,

      userId: input.userId,

      teamId: input.teamId,

      limit,
    };

    if (input.campaignId) {
      repositoryInput.campaignId = input.campaignId;
    }

    const search = input.search?.trim();

    if (search) {
      repositoryInput.search = search;
    }

    if (cursor) {
      repositoryInput.cursor = {
        assignedAt: new Date(cursor.assignedAt),

        assignmentId: cursor.assignmentId,
      };
    }

    const rows = await this.workQueueRepository.findAssignedProspects(repositoryInput);

    /*
     * Repository intentionally fetches limit + 1.
     *
     * The extra row tells us whether another page
     * exists without requiring a separate COUNT query.
     */
    const hasMore = rows.length > limit;

    const items = hasMore ? rows.slice(0, limit) : rows;

    const lastItem = items.at(-1);

    const nextCursor =
      hasMore && lastItem
        ? this.encodeCursor({
            assignedAt: lastItem.assignment.assignedAt.toISOString(),

            assignmentId: lastItem.assignment.id,
          })
        : null;

    return {
      items,

      page: {
        limit,

        hasMore,

        nextCursor,
      },
    };
  }

  /*
   * Both Work Queue list and detail reads use exactly
   * the same durable authorization rule.
   *
   * A manager grant does not implicitly become a
   * Prospector grant.
   *
   * A Prospector grant for Team A does not authorize
   * Team B.
   */
  private async requireProspectorWorkspaceAccess(
    tenantId: string,
    userId: string,
    teamId: string,
  ): Promise<void> {
    const grants = await this.authorizationService.getUserGrants(tenantId, userId);

    const prospectorGrant = grants.find(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.teamId === teamId &&
        grant.organizationId !== null,
    );

    if (!prospectorGrant) {
      throw new ForbiddenException('User does not have access to this prospector workspace');
    }
  }

  private encodeCursor(cursor: WorkQueueCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(encodedCursor: string): WorkQueueCursor {
    try {
      const decoded = Buffer.from(encodedCursor, 'base64url').toString('utf8');

      const parsed: unknown = JSON.parse(decoded);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('assignedAt' in parsed) ||
        !('assignmentId' in parsed)
      ) {
        throw new Error('Invalid cursor payload');
      }

      const assignedAt = parsed.assignedAt;

      const assignmentId = parsed.assignmentId;

      if (typeof assignedAt !== 'string' || typeof assignmentId !== 'string') {
        throw new Error('Invalid cursor fields');
      }

      const parsedDate = new Date(assignedAt);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error('Invalid cursor timestamp');
      }

      if (!this.isUuid(assignmentId)) {
        throw new Error('Invalid cursor assignment ID');
      }

      /*
       * Normalize the timestamp before returning it.
       *
       * This prevents unusual-but-parseable date
       * strings from becoming part of repository
       * behavior.
       */
      return {
        assignedAt: parsedDate.toISOString(),

        assignmentId,
      };
    } catch {
      throw new BadRequestException('Invalid work queue cursor');
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
