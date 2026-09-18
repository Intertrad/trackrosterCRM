import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { establishmentContacts } from '../database/schema/establishment-contacts.js';
import { establishments } from '../database/schema/establishments.js';
import type { Database } from '../database/database.types.js';

export interface WorkQueueTeamScope {
  organizationId: string;
  teamId: string;
}

export interface WorkQueueCursor {
  assignedAt: Date;
  id: string;
}

export interface WorkQueueRepositoryOptions {
  userId: string;

  teamScopes: WorkQueueTeamScope[];

  search?: string;

  limit: number;

  cursor?: WorkQueueCursor | null;
}

export interface WorkQueueRepositoryItem {
  assignmentId: string;
  campaignProspectId: string;

  assignedAt: Date;

  campaignId: string;
  campaignName: string;

  establishmentId: string;
  establishmentName: string;

  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;

  establishmentPhone: string | null;
  website: string | null;

  latitude: number | null;
  longitude: number | null;

  primaryContactId: string | null;
  primaryContactName: string | null;
  primaryContactJobTitle: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
}

export interface WorkQueueRepositoryPage {
  items: WorkQueueRepositoryItem[];

  nextCursor: WorkQueueCursor | null;
}

@Injectable()
export class WorkQueueRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findAssignedQueue(
    tenantId: string,
    options: WorkQueueRepositoryOptions,
  ): Promise<WorkQueueRepositoryPage> {
    const { userId, teamScopes, search, limit, cursor = null } = options;

    /*
     * The service should reject users with no
     * Prospector scopes before reaching here.
     *
     * Keep this defensive check so this repository
     * can never accidentally broaden the query.
     */
    if (teamScopes.length === 0) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    /*
     * Match exact organization + team grant pairs.
     *
     * Do not reduce this to only teamId even though
     * UUIDs are unique. Keeping the organization
     * dimension mirrors the authorization model.
     */
    const scopeCondition = or(
      ...teamScopes.map((scope) =>
        and(
          eq(campaignProspectAssignments.organizationId, scope.organizationId),
          eq(campaignProspectAssignments.teamId, scope.teamId),
        ),
      ),
    );

    if (!scopeCondition) {
      return {
        items: [],
        nextCursor: null,
      };
    }

    const normalizedSearch = search?.trim();

    const searchCondition = normalizedSearch
      ? or(
          ilike(establishments.name, `%${normalizedSearch}%`),
          ilike(establishments.city, `%${normalizedSearch}%`),
          ilike(establishments.postalCode, `%${normalizedSearch}%`),
          ilike(campaigns.name, `%${normalizedSearch}%`),
        )
      : undefined;

    const baseCondition = searchCondition
      ? and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspectAssignments.assignedUserId, userId),
          isNull(campaignProspectAssignments.endedAt),
          eq(campaignProspects.status, 'active'),
          eq(campaigns.status, 'active'),
          scopeCondition,
          searchCondition,
        )
      : and(
          eq(campaignProspectAssignments.tenantId, tenantId),
          eq(campaignProspectAssignments.assignedUserId, userId),
          isNull(campaignProspectAssignments.endedAt),
          eq(campaignProspects.status, 'active'),
          eq(campaigns.status, 'active'),
          scopeCondition,
        );

    /*
     * Ordering:
     *
     * assignedAt DESC
     * assignmentId DESC
     *
     * The UUID tie-breaker makes pagination stable
     * when assignments share the same timestamp.
     */
    const cursorCondition = cursor
      ? or(
          lt(campaignProspectAssignments.assignedAt, cursor.assignedAt),

          and(
            eq(campaignProspectAssignments.assignedAt, cursor.assignedAt),
            lt(campaignProspectAssignments.id, cursor.id),
          ),
        )
      : undefined;

    const rows = await this.database
      .select({
        assignmentId: campaignProspectAssignments.id,

        campaignProspectId: campaignProspectAssignments.campaignProspectId,

        assignedAt: campaignProspectAssignments.assignedAt,

        campaignId: campaigns.id,
        campaignName: campaigns.name,

        establishmentId: establishments.id,
        establishmentName: establishments.name,

        addressLine1: establishments.addressLine1,

        postalCode: establishments.postalCode,

        city: establishments.city,

        countryCode: establishments.countryCode,

        establishmentPhone: establishments.phone,

        website: establishments.website,

        latitude: establishments.latitude,

        longitude: establishments.longitude,

        primaryContactId: establishmentContacts.id,

        primaryContactName: establishmentContacts.name,

        primaryContactJobTitle: establishmentContacts.jobTitle,

        primaryContactEmail: establishmentContacts.email,

        primaryContactPhone: establishmentContacts.phone,
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),
          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),
          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .innerJoin(
        establishments,
        and(
          eq(campaignProspects.tenantId, establishments.tenantId),
          eq(campaignProspects.establishmentId, establishments.id),
        ),
      )
      .leftJoin(
        establishmentContacts,
        and(
          eq(establishmentContacts.tenantId, establishments.tenantId),
          eq(establishmentContacts.establishmentId, establishments.id),
          eq(establishmentContacts.isPrimary, true),
          eq(establishmentContacts.status, 'active'),
        ),
      )
      .where(cursorCondition ? and(baseCondition, cursorCondition) : baseCondition)
      .orderBy(desc(campaignProspectAssignments.assignedAt), desc(campaignProspectAssignments.id))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;

    const items = hasNextPage ? rows.slice(0, limit) : rows;

    const lastItem = items.at(-1);

    return {
      items,

      nextCursor:
        hasNextPage && lastItem
          ? {
              assignedAt: lastItem.assignedAt,

              id: lastItem.assignmentId,
            }
          : null,
    };
  }
}
