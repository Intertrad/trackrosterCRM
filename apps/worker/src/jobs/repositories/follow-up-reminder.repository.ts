import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';

export interface FollowUpReminderContext {
  id: string;

  tenantId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  assignedUserId: string | null;

  dueAt: Date;

  status: string;

  organizationId: string;

  teamId: string;

  assignmentEndedAt: Date | null;

  campaignStatus: string;

  campaignProspectStatus: string;
}

interface FollowUpReminderContextRow {
  id: string;

  tenantId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  assignedUserId: string | null;

  dueAt: Date;

  status: string;

  organizationId: string;

  teamId: string;

  assignmentEndedAt: Date | null;

  campaignStatus: string;

  campaignProspectStatus: string;
}

interface RecipientRow {
  userId: string;
}

@Injectable()
export class FollowUpReminderRepository {
  constructor(
    @Inject(WORKER_DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  /*
   * Load the source row and the business state
   * needed to decide whether this delayed job is
   * still actionable.
   *
   * Tenant + campaign + prospect + follow-up are
   * all included so a queued identifier cannot
   * escape its original scope.
   */
  async findContext(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    followUpId: string,
  ): Promise<FollowUpReminderContext | null> {
    const result = await this.pool.query<FollowUpReminderContextRow>(
      `
          SELECT
            follow_up.id
              AS "id",

            follow_up.tenant_id
              AS "tenantId",

            follow_up.campaign_id
              AS "campaignId",

            follow_up.campaign_prospect_id
              AS "campaignProspectId",

            follow_up.establishment_id
              AS "establishmentId",

            follow_up.assignment_id
              AS "assignmentId",

            follow_up.assigned_user_id
              AS "assignedUserId",

            follow_up.due_at
              AS "dueAt",

            follow_up.status
              AS "status",

            assignment.organization_id
              AS "organizationId",

            assignment.team_id
              AS "teamId",

            assignment.ended_at
              AS "assignmentEndedAt",

            campaign.status
              AS "campaignStatus",

            campaign_prospect.status
              AS "campaignProspectStatus"

          FROM prospect_follow_ups
            AS follow_up

          INNER JOIN
            campaign_prospect_assignments
              AS assignment
            ON
              assignment.tenant_id =
                follow_up.tenant_id
              AND
              assignment.id =
                follow_up.assignment_id
              AND
              assignment.campaign_id =
                follow_up.campaign_id
              AND
              assignment.campaign_prospect_id =
                follow_up.campaign_prospect_id

          INNER JOIN campaigns
            AS campaign
            ON
              campaign.tenant_id =
                follow_up.tenant_id
              AND
              campaign.id =
                follow_up.campaign_id

          INNER JOIN campaign_prospects
            AS campaign_prospect
            ON
              campaign_prospect.tenant_id =
                follow_up.tenant_id
              AND
              campaign_prospect.campaign_id =
                follow_up.campaign_id
              AND
              campaign_prospect.id =
                follow_up.campaign_prospect_id

          WHERE
            follow_up.tenant_id = $1

            AND
            follow_up.campaign_id = $2

            AND
            follow_up.campaign_prospect_id = $3

            AND
            follow_up.id = $4

          LIMIT 1
        `,
      [tenantId, campaignId, campaignProspectId, followUpId],
    );

    return result.rows[0] ?? null;
  }

  /*
   * Resolve notification recipients at execution
   * time rather than capturing membership when
   * the job is scheduled.
   *
   * A personally owned follow-up still requires
   * the user to be active and retain the exact
   * team-level prospector grant.
   *
   * A team-owned follow-up fans out to every active
   * prospector currently holding that exact grant.
   */
  async findEligibleRecipientUserIds(context: FollowUpReminderContext): Promise<string[]> {
    if (context.assignedUserId !== null) {
      const result = await this.pool.query<RecipientRow>(
        `
            SELECT DISTINCT
              users.id
                AS "userId"

            FROM users

            INNER JOIN user_access_grants
              AS access_grant
              ON
                access_grant.tenant_id =
                  users.tenant_id
                AND
                access_grant.user_id =
                  users.id

            WHERE
              users.tenant_id = $1

              AND
              users.id = $2

              AND
              users.status = 'active'

              AND
              access_grant.role = 'prospector'

              AND
              access_grant.scope_type = 'team'

              AND
              access_grant.organization_id = $3

              AND
              access_grant.team_id = $4
          `,
        [context.tenantId, context.assignedUserId, context.organizationId, context.teamId],
      );

      return result.rows.map((row) => row.userId);
    }

    const result = await this.pool.query<RecipientRow>(
      `
          SELECT DISTINCT
            users.id
              AS "userId"

          FROM users

          INNER JOIN user_access_grants
            AS access_grant
            ON
              access_grant.tenant_id =
                users.tenant_id
              AND
              access_grant.user_id =
                users.id

          WHERE
            users.tenant_id = $1

            AND
            users.status = 'active'

            AND
            access_grant.role = 'prospector'

            AND
            access_grant.scope_type = 'team'

            AND
            access_grant.organization_id = $2

            AND
            access_grant.team_id = $3

          ORDER BY
            users.id
        `,
      [context.tenantId, context.organizationId, context.teamId],
    );

    return result.rows.map((row) => row.userId);
  }

  /*
   * Insert one persisted notification for every
   * resolved recipient.
   *
   * PostgreSQL's unique index is the final
   * idempotency boundary. A retry therefore does
   * not create duplicate notifications.
   */
  async createNotificationsIfAbsent(
    context: FollowUpReminderContext,

    recipientUserIds: string[],

    scheduledFor: Date,
  ): Promise<number> {
    if (recipientUserIds.length === 0) {
      return 0;
    }

    const result = await this.pool.query(
      `
          INSERT INTO notifications (
            tenant_id,
            recipient_user_id,
            type,
            follow_up_id,
            scheduled_for,
            title,
            message
          )

          SELECT
            $1,
            recipient.user_id,
            'follow_up_reminder',
            $2,
            $3,
            $4,
            $5

          FROM unnest(
            $6::uuid[]
          ) AS recipient(user_id)

          ON CONFLICT (
            tenant_id,
            recipient_user_id,
            type,
            follow_up_id,
            scheduled_for
          )
          DO NOTHING

          RETURNING id
        `,
      [
        context.tenantId,

        context.id,

        scheduledFor,

        'Follow-up due',

        'A prospect follow-up is due.',

        recipientUserIds,
      ],
    );

    return result.rowCount ?? 0;
  }
}
