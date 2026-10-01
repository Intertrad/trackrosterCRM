import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { ReservationRedisService } from '../../reservations/reservation-redis.service.js';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';

export interface StoredReservation {
  reservationId: string;

  tenantId: string;

  organizationId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  teamId: string;

  userId: string;

  acquiredAt: string;

  expiresAt: string;
}

export interface ReleaseExpiredReservationInput {
  tenantId: string;

  reservationId: string;

  organizationId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  expiresAt: string;
}

@Injectable()
export class ReservationExpiryRepository {
  constructor(
    private readonly redisService: ReservationRedisService,
    @Optional() @Inject(WORKER_DATABASE_POOL) private readonly pool?: Pool,
  ) {}

  async notifyExpiredWithoutSummary(reservation: StoredReservation): Promise<number> {
    if (!this.pool) return 0;
    const result = await workerTenantQuery(
      this.pool,
      reservation.tenantId,
      `
        WITH recipients AS (
          SELECT m.id AS user_id
          FROM tenant_memberships m
          JOIN identities i ON i.id=m.identity_id AND i.status='active'
          JOIN user_access_grants pg
            ON pg.tenant_id=m.tenant_id AND pg.user_id=m.id
           AND pg.role='prospector' AND pg.scope_type='team' AND pg.team_id=$2
          WHERE m.tenant_id=$1 AND m.id=$5 AND m.status='active'
          UNION
          SELECT g.user_id
          FROM user_access_grants g
          JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id AND m.status='active'
          JOIN identities i ON i.id=m.identity_id AND i.status='active'
          WHERE g.tenant_id=$1 AND g.role='manager' AND g.scope_type='team' AND g.team_id=$2
        ),
        eligible AS (
          SELECT r.user_id FROM recipients r
          WHERE NOT EXISTS (
            SELECT 1 FROM actions a
            WHERE a.tenant_id=$1 AND a.reservation_id=$3 AND a.status='completed'
              AND NULLIF(BTRIM(COALESCE(a.notes,'')), '') IS NOT NULL
          )
        )
        INSERT INTO notifications
          (tenant_id, recipient_user_id, type, severity, event_key, title, message, payload)
        SELECT $1, e.user_id, 'reservation_expired_without_summary', 'warning',
               'reservation-expired:' || $3::text,
               'Reservation expired without summary',
               'The reservation expired without a completed action summary.',
               jsonb_build_object('reservationId', $3::text, 'campaignProspectId', $4::text)
        FROM eligible e
        ON CONFLICT (tenant_id, recipient_user_id, type, event_key) DO NOTHING
        RETURNING id
      `,
      [
        reservation.tenantId,
        reservation.teamId,
        reservation.reservationId,
        reservation.campaignProspectId,
        reservation.userId,
      ],
    );
    return result.rowCount;
  }

  async findCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<StoredReservation | null> {
    const client = this.redisService.getClient();

    const value = await client.get(
      this.buildReservationKey(tenantId, campaignId, campaignProspectId),
    );

    if (!value) {
      return null;
    }

    return this.parseReservation(value);
  }

  /*
   * Atomically release only this exact reservation
   * generation.
   *
   * A delayed job belonging to an older reservation
   * can never remove a newer reservation because
   * reservationId, organizationId,
   * establishmentId and expiresAt must all match.
   */
  async releaseIfMatch(input: ReleaseExpiredReservationInput): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildReservationKey(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    const collisionKey = this.buildOrganizationCollisionKey(
      input.tenantId,
      input.organizationId,
      input.establishmentId,
    );

    const script = `
      local reservationValue =
        redis.call('GET', KEYS[1])

      if not reservationValue then
        return 0
      end

      local reservation =
        cjson.decode(reservationValue)

      if reservation.reservationId ~= ARGV[1] then
        return 0
      end

      if reservation.organizationId ~= ARGV[2] then
        return 0
      end

      if reservation.establishmentId ~= ARGV[3] then
        return 0
      end

      if reservation.expiresAt ~= ARGV[4] then
        return 0
      end

      local collisionValue =
        redis.call('GET', KEYS[2])

      if collisionValue then
        local collision =
          cjson.decode(collisionValue)

        if collision.reservationId ~= ARGV[1] then
          return -1
        end
      end

      redis.call(
        'DEL',
        KEYS[1]
      )

      if collisionValue then
        redis.call(
          'DEL',
          KEYS[2]
        )
      end

      return 1
    `;

    const result = await client.eval(
      script,
      2,
      reservationKey,
      collisionKey,
      input.reservationId,
      input.organizationId,
      input.establishmentId,
      input.expiresAt,
    );

    return Number(result) === 1;
  }

  private buildReservationKey(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  private buildOrganizationCollisionKey(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): string {
    return ['trackroster', 'collision', tenantId, organizationId, establishmentId].join(':');
  }

  private parseReservation(value: string): StoredReservation {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('reservationId' in parsed) ||
      !('tenantId' in parsed) ||
      !('organizationId' in parsed) ||
      !('campaignId' in parsed) ||
      !('campaignProspectId' in parsed) ||
      !('establishmentId' in parsed) ||
      !('assignmentId' in parsed) ||
      !('teamId' in parsed) ||
      !('userId' in parsed) ||
      !('acquiredAt' in parsed) ||
      !('expiresAt' in parsed)
    ) {
      throw new Error('Invalid reservation stored in Redis');
    }

    return parsed as StoredReservation;
  }
}
