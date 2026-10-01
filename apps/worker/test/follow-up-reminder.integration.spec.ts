import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FollowUpReminderJobData } from '@trackroster/jobs';

import { FollowUpReminderProcessor } from '../src/jobs/processors/follow-up-reminder.processor.js';
import { FollowUpReminderRepository } from '../src/jobs/repositories/follow-up-reminder.repository.js';

describe('Follow-up reminder PostgreSQL integration', () => {
  let pool: Pool;

  let runtimePool: Pool;

  let repository: FollowUpReminderRepository;

  let processor: FollowUpReminderProcessor;

  const tenantId = randomUUID();

  const organizationId = randomUUID();

  const teamId = randomUUID();

  const campaignId = randomUUID();

  const establishmentId = randomUUID();

  const campaignProspectId = randomUUID();

  const userId = randomUUID();

  const assignmentId = randomUUID();

  const followUpId = randomUUID();

  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);

  const scheduledFor = new Date('2026-09-10T14:00:00.000Z');

  beforeAll(async () => {
    const databaseUrl =
      process.env.DATABASE_SEED_URL ??
      process.env.DATABASE_URL ??
      'postgresql://trackroster:trackroster@127.0.0.1:5433/trackroster';
    const runtimeDatabaseUrl = process.env.DATABASE_URL ?? databaseUrl;

    pool = new Pool({
      connectionString: databaseUrl,
    });

    runtimePool = new Pool({
      connectionString: runtimeDatabaseUrl,
    });

    await pool.query('SELECT 1');
    await runtimePool.query('SELECT 1');

    repository = new FollowUpReminderRepository(runtimePool);

    processor = new FollowUpReminderProcessor(repository);

    /*
     * Tenant.
     */
    await pool.query(
      `
        INSERT INTO tenants (
          id,
          name,
          slug,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'active'
        )
      `,
      [tenantId, `Reminder Tenant ${suffix}`, `reminder-${suffix}`],
    );

    /*
     * Organization.
     */
    await pool.query(
      `
        INSERT INTO organizations (
          id,
          tenant_id,
          name,
          slug,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'active'
        )
      `,
      [organizationId, tenantId, `Reminder Organization ${suffix}`, `reminder-org-${suffix}`],
    );

    /*
     * Team.
     */
    await pool.query(
      `
        INSERT INTO teams (
          id,
          tenant_id,
          organization_id,
          name,
          slug,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'active'
        )
      `,
      [teamId, tenantId, organizationId, `Reminder Team ${suffix}`, `reminder-team-${suffix}`],
    );

    /*
     * Campaign.
     */
    await pool.query(
      `
        INSERT INTO campaigns (
          id,
          tenant_id,
          organization_id,
          name,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'active'
        )
      `,
      [campaignId, tenantId, organizationId, `Reminder Campaign ${suffix}`],
    );

    /*
     * Canonical establishment.
     *
     * These are the same required fields already
     * used by the API integration fixtures.
     */
    await pool.query(
      `
        INSERT INTO establishments (
          id,
          tenant_id,
          name,
          normalized_name,
          city,
          country_code,
          source,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'Paris',
          'FR',
          'manual',
          'active'
        )
      `,
      [
        establishmentId,
        tenantId,
        `Reminder Establishment ${suffix}`,
        `reminder establishment ${suffix}`,
      ],
    );

    /*
     * Campaign prospect.
     */
    await pool.query(
      `
        INSERT INTO campaign_prospects (
          id,
          tenant_id,
          campaign_id,
          establishment_id,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'active'
        )
      `,
      [campaignProspectId, tenantId, campaignId, establishmentId],
    );

    /*
     * Active prospector.
     *
     * This test does not authenticate, so the hash
     * only needs to satisfy the users table shape.
     */
    await pool.query(
      `
        INSERT INTO users (
          id,
          tenant_id,
          email,
          password_hash,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'active'
        )
      `,
      [userId, tenantId, `reminder-${suffix}@trackroster.test`, 'integration-test-password-hash'],
    );

    /*
     * Exact team-scoped prospector grant.
     */
    await pool.query(
      `
        INSERT INTO user_access_grants (
          tenant_id,
          user_id,
          role,
          scope_type,
          organization_id,
          team_id
        )
        VALUES (
          $1,
          $2,
          'prospector',
          'team',
          $3,
          $4
        )
      `,
      [tenantId, userId, organizationId, teamId],
    );

    /*
     * Current user-owned assignment.
     */
    await pool.query(
      `
        INSERT INTO campaign_prospect_assignments (
          id,
          tenant_id,
          campaign_id,
          campaign_prospect_id,
          organization_id,
          team_id,
          assigned_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
      `,
      [assignmentId, tenantId, campaignId, campaignProspectId, organizationId, teamId, userId],
    );

    /*
     * Pending follow-up whose dueAt exactly matches
     * the delayed-job scheduledFor value.
     */
    await pool.query(
      `
        INSERT INTO prospect_follow_ups (
          id,
          tenant_id,
          campaign_id,
          campaign_prospect_id,
          establishment_id,
          assignment_id,
          assigned_user_id,
          created_by,
          due_at,
          status,
          completed_at,
          cancelled_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $7,
          $8,
          'pending',
          NULL,
          NULL
        )
      `,
      [
        followUpId,
        tenantId,
        campaignId,
        campaignProspectId,
        establishmentId,
        assignmentId,
        userId,
        scheduledFor,
      ],
    );
  }, 15_000);

  afterAll(async () => {
    if (!pool) {
      return;
    }

    /*
     * Remove only this test's tenant-scoped
     * fixtures, in reverse foreign-key order.
     */
    try {
      await pool.query(
        `
          DELETE FROM notifications
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM prospect_follow_ups
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM user_access_grants
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM campaign_prospect_assignments
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM campaign_prospects
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM users
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM campaigns
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM establishments
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM teams
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM organizations
          WHERE tenant_id = $1
        `,
        [tenantId],
      );

      await pool.query(
        `
          DELETE FROM tenants
          WHERE id = $1
        `,
        [tenantId],
      );
    } finally {
      await pool.end();
      await runtimePool.end();
    }
  }, 15_000);

  it('creates exactly one notification when the same reminder is processed twice', async () => {
    const data: FollowUpReminderJobData = {
      jobId: randomUUID(),

      tenantId,

      requestedAt: '2026-09-10T13:00:00.000Z',

      followUpId,

      campaignId,

      campaignProspectId,

      scheduledFor: scheduledFor.toISOString(),
    };

    const firstResult = await processor.process(data, {
      jobId: data.jobId,

      attempt: 1,

      maxAttempts: 3,
    });

    /*
     * Simulate at-least-once delivery / worker retry.
     *
     * A retry may use a later processing attempt,
     * but the domain payload still represents the
     * same follow-up schedule.
     */
    const secondResult = await processor.process(data, {
      jobId: data.jobId,

      attempt: 2,

      maxAttempts: 3,
    });

    expect(firstResult).toEqual({
      status: 'processed',
    });

    expect(secondResult).toEqual({
      status: 'processed',
    });

    const notificationResult = await pool.query<{
      count: string;
    }>(
      `
          SELECT COUNT(*)::text AS count

          FROM notifications

          WHERE tenant_id = $1

            AND recipient_user_id = $2

            AND type = 'follow_up_reminder'

            AND follow_up_id = $3

            AND scheduled_for = $4
        `,
      [tenantId, userId, followUpId, scheduledFor],
    );

    expect(notificationResult.rows[0]?.count).toBe('1');

    const [notification] = (
      await pool.query<{
        recipientUserId: string;

        type: string;

        followUpId: string;

        scheduledFor: Date;

        title: string;

        message: string;

        readAt: Date | null;
      }>(
        `
            SELECT
              recipient_user_id
                AS "recipientUserId",

              type,

              follow_up_id
                AS "followUpId",

              scheduled_for
                AS "scheduledFor",

              title,

              message,

              read_at
                AS "readAt"

            FROM notifications

            WHERE tenant_id = $1

              AND recipient_user_id = $2

              AND follow_up_id = $3
          `,
        [tenantId, userId, followUpId],
      )
    ).rows;

    expect(notification).toMatchObject({
      recipientUserId: userId,

      type: 'follow_up_reminder',

      followUpId,

      title: 'Follow-up due',

      message: 'A prospect follow-up is due.',

      readAt: null,
    });

    expect(notification?.scheduledFor.toISOString()).toBe(scheduledFor.toISOString());
  });
  it('suppresses reminders while prospect opposition is effective', async () => {
    const staleContext = await repository.findContext(
      tenantId,
      campaignId,
      campaignProspectId,
      followUpId,
    );
    expect(staleContext).not.toBeNull();
    await pool.query(
      `INSERT INTO contact_consents (tenant_id,prospect_id,channel,status,reason,recorded_by) VALUES ($1,$2,'all','blocked','Opposition evidence',$3)`,
      [tenantId, establishmentId, userId],
    );
    try {
      expect(
        await repository.findContext(tenantId, campaignId, campaignProspectId, followUpId),
      ).toBeNull();
      expect(
        await repository.createNotificationsIfAbsent(staleContext!, [userId], new Date()),
      ).toBe(0);
    } finally {
      await pool.query('DELETE FROM contact_consents WHERE tenant_id=$1', [tenantId]);
    }
  });
});
