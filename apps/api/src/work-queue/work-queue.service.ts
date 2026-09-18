import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AuthorizationService } from '../authorization/authorization.service.js';

import type { WorkQueueItemDto, WorkQueueResponseDto } from './work-queue.dto.js';

import {
  WorkQueueRepository,
  type WorkQueueCursor,
  type WorkQueueRepositoryItem,
  type WorkQueueTeamScope,
} from './work-queue.repository.js';

const DEFAULT_WORK_QUEUE_LIMIT = 50;
const MAX_WORK_QUEUE_LIMIT = 100;

export interface ListWorkQueueInput {
  tenantId: string;
  userId: string;

  search?: string;

  limit?: number;

  cursor?: string;
}

interface SerializedWorkQueueCursor {
  assignedAt: string;
  id: string;
}

@Injectable()
export class WorkQueueService {
  constructor(
    private readonly workQueueRepository: WorkQueueRepository,

    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(input: ListWorkQueueInput): Promise<WorkQueueResponseDto> {
    const limit = input.limit ?? DEFAULT_WORK_QUEUE_LIMIT;

    this.requireValidLimit(limit);

    /*
     * Work Queue is explicitly a Prospector
     * operational surface.
     *
     * Manager/Director/Admin authority must not
     * silently imply Prospector queue access.
     */
    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    const uniqueScopes = new Map<string, WorkQueueTeamScope>();

    for (const grant of grants) {
      if (
        grant.role !== 'prospector' ||
        grant.scopeType !== 'team' ||
        grant.organizationId === null ||
        grant.teamId === null
      ) {
        continue;
      }

      const key = `${grant.organizationId}:${grant.teamId}`;

      uniqueScopes.set(key, {
        organizationId: grant.organizationId,

        teamId: grant.teamId,
      });
    }

    const teamScopes = Array.from(uniqueScopes.values());

    if (teamScopes.length === 0) {
      throw new ForbiddenException('User does not have a prospector team scope');
    }

    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;

    const normalizedSearch = input.search?.trim() || undefined;

    try {
      const page = await this.workQueueRepository.findAssignedQueue(input.tenantId, {
        userId: input.userId,

        teamScopes,

        search: normalizedSearch,

        limit,

        cursor,
      });

      return {
        items: page.items.map((item) => this.toPublicItem(item)),

        nextCursor: page.nextCursor ? this.encodeCursor(page.nextCursor) : null,
      };
    } catch (error) {
      /*
       * Preserve explicit validation/auth errors.
       *
       * Database/query failures should not leak
       * implementation details.
       */
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new ServiceUnavailableException('Work queue service is unavailable');
    }
  }

  private toPublicItem(item: WorkQueueRepositoryItem): WorkQueueItemDto {
    return {
      assignmentId: item.assignmentId,

      campaignProspectId: item.campaignProspectId,

      assignedAt: item.assignedAt.toISOString(),

      campaign: {
        id: item.campaignId,
        name: item.campaignName,
      },

      establishment: {
        id: item.establishmentId,

        name: item.establishmentName,

        addressLine1: item.addressLine1,

        postalCode: item.postalCode,

        city: item.city,

        countryCode: item.countryCode,

        phone: item.establishmentPhone,

        website: item.website,

        latitude: item.latitude,

        longitude: item.longitude,
      },

      primaryContact: item.primaryContactId
        ? {
            id: item.primaryContactId,

            name: item.primaryContactName,

            jobTitle: item.primaryContactJobTitle,

            email: item.primaryContactEmail,

            phone: item.primaryContactPhone,
          }
        : null,
    };
  }

  private encodeCursor(cursor: WorkQueueCursor): string {
    const serialized: SerializedWorkQueueCursor = {
      assignedAt: cursor.assignedAt.toISOString(),

      id: cursor.id,
    };

    return Buffer.from(JSON.stringify(serialized), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): WorkQueueCursor {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');

      const parsed: unknown = JSON.parse(decoded);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('assignedAt' in parsed) ||
        !('id' in parsed)
      ) {
        throw new Error('Malformed cursor');
      }

      const { assignedAt, id } = parsed;

      if (typeof assignedAt !== 'string' || typeof id !== 'string') {
        throw new Error('Malformed cursor values');
      }

      const assignedAtDate = new Date(assignedAt);

      if (Number.isNaN(assignedAtDate.getTime()) || !this.isUuid(id)) {
        throw new Error('Invalid cursor values');
      }

      return {
        assignedAt: assignedAtDate,
        id,
      };
    } catch {
      throw new BadRequestException('Invalid work queue cursor');
    }
  }

  private requireValidLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_WORK_QUEUE_LIMIT) {
      throw new BadRequestException('Work queue limit must be between 1 and 100');
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
