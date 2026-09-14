import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { ProspectActivityRepository } from './prospect-activity.repository.js';
import type {
  ProspectTimelineActivityItem,
  ProspectTimelineCursor,
  ProspectTimelinePage,
} from './prospect-timeline.types.js';

const DEFAULT_TIMELINE_LIMIT = 50;
const MAX_TIMELINE_LIMIT = 100;

export interface GetProspectTimelineInput {
  tenantId: string;
  userId: string;

  campaignId: string;
  campaignProspectId: string;

  limit?: number;

  cursor?: string;
}

interface SerializedTimelineCursor {
  occurredAt: string;

  createdAt: string;

  id: string;
}

@Injectable()
export class ProspectTimelineService {
  constructor(
    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly campaignProspectRepository: CampaignProspectRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly authorizationService: AuthorizationService,
  ) {}

  async getTimeline(input: GetProspectTimelineInput): Promise<ProspectTimelinePage> {
    const limit = input.limit ?? DEFAULT_TIMELINE_LIMIT;

    this.requireValidLimit(limit);

    /*
     * Timeline reads intentionally do NOT reuse
     * ReservationService.requireReservationEligibility().
     *
     * Historical data must remain readable when:
     *
     * - the campaign is completed/archived
     * - the prospect has been excluded
     * - the prospect has been reassigned
     * - no Redis reservation exists
     *
     * Therefore this read path validates identity
     * and read scope independently.
     */
    const campaign = await this.campaignRepository.findById(input.tenantId, input.campaignId);

    /*
     * Do not distinguish between:
     *
     * - missing campaign
     * - missing campaign prospect
     * - existing but unauthorized campaign prospect
     *
     * All three cases use the same public resource
     * response to prevent same-tenant enumeration.
     */
    if (!campaign) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * Authorization follows CURRENT ownership.
     *
     * Historical activity itself is not filtered
     * by historical team ownership.
     *
     * If Team B owns the prospect today, an
     * authorized Team B user sees the complete
     * immutable history, including actions
     * previously performed by Team A.
     */
    const currentAssignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    let canView: boolean;

    if (currentAssignment) {
      /*
       * canViewTeam already supports:
       *
       * - tenant client_admin
       * - tenant observer
       * - organization director
       * - organization observer
       * - team manager
       * - team prospector
       * - team observer
       */
      canView = await this.authorizationService.canViewTeam(
        input.tenantId,
        input.userId,
        currentAssignment.organizationId,
        currentAssignment.teamId,
      );
    } else {
      /*
       * An unassigned prospect has no legitimate
       * current team scope.
       *
       * Tenant- and organization-level viewers
       * may still read its historical timeline.
       */
      canView = await this.authorizationService.canViewOrganization(
        input.tenantId,
        input.userId,
        campaign.organizationId,
      );
    }

    /*
     * Mask an existing-but-forbidden prospect as
     * not found.
     *
     * This prevents an authenticated user from
     * determining whether a prospect exists outside
     * their authorized organization/team scope.
     */
    if (!canView) {
      throw new NotFoundException('Campaign prospect not found');
    }

    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;

    const page = await this.prospectActivityRepository.findTimelineByCampaignProspect(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
      {
        limit,

        cursor,
      },
    );

    return {
      items: page.items.map((activity) => this.toTimelineItem(activity)),

      nextCursor: page.nextCursor ? this.encodeCursor(page.nextCursor) : null,
    };
  }

  private toTimelineItem(activity: {
    id: string;

    campaignId: string;
    campaignProspectId: string;

    establishmentId: string;
    assignmentId: string;

    userId: string;

    type: 'call' | 'email' | 'message' | 'visit';

    occurredAt: Date;
  }): ProspectTimelineActivityItem {
    return {
      kind: 'activity',

      id: activity.id,

      occurredAt: activity.occurredAt.toISOString(),

      activityType: activity.type,

      actor: {
        userId: activity.userId,
      },

      context: {
        campaignId: activity.campaignId,

        campaignProspectId: activity.campaignProspectId,

        establishmentId: activity.establishmentId,

        assignmentId: activity.assignmentId,
      },
    };
  }

  private encodeCursor(cursor: ProspectTimelineCursor): string {
    const serialized: SerializedTimelineCursor = {
      occurredAt: cursor.occurredAt.toISOString(),

      createdAt: cursor.createdAt.toISOString(),

      id: cursor.id,
    };

    return Buffer.from(JSON.stringify(serialized), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): ProspectTimelineCursor {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');

      const parsed: unknown = JSON.parse(decoded);

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('occurredAt' in parsed) ||
        !('createdAt' in parsed) ||
        !('id' in parsed)
      ) {
        throw new Error('Malformed cursor');
      }

      const { occurredAt, createdAt, id } = parsed;

      if (
        typeof occurredAt !== 'string' ||
        typeof createdAt !== 'string' ||
        typeof id !== 'string'
      ) {
        throw new Error('Malformed cursor values');
      }

      const occurredAtDate = new Date(occurredAt);

      const createdAtDate = new Date(createdAt);

      if (
        Number.isNaN(occurredAtDate.getTime()) ||
        Number.isNaN(createdAtDate.getTime()) ||
        !this.isUuid(id)
      ) {
        throw new Error('Invalid cursor values');
      }

      return {
        occurredAt: occurredAtDate,

        createdAt: createdAtDate,

        id,
      };
    } catch {
      throw new BadRequestException('Invalid timeline cursor');
    }
  }

  private requireValidLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TIMELINE_LIMIT) {
      throw new BadRequestException('Timeline limit must be between 1 and 100');
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
