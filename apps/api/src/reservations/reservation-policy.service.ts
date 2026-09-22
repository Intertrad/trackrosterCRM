import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { reservationRules } from '../database/schema/index.js';
@Injectable()
export class ReservationPolicyService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}
  async resolve(tenantId: string, campaignId: string, tx: DatabaseExecutor = this.db) {
    const [rule] = await tx
      .select()
      .from(reservationRules)
      .where(
        and(
          eq(reservationRules.tenantId, tenantId),
          eq(reservationRules.isActive, true),
          or(eq(reservationRules.campaignId, campaignId), isNull(reservationRules.campaignId)),
        ),
      )
      .orderBy(sql`${reservationRules.campaignId} NULLS LAST`)
      .limit(1);
    return (
      rule ?? {
        id: null,
        tenantId,
        campaignId: null,
        durationMinutes: 20,
        cooldownMinutes: Number(this.config.getOrThrow('PROSPECT_COOLING_OFF_MINUTES')),
        maxHoldMinutes: 120,
        allowHeartbeat: true,
        allowExtension: true,
        allowManagerOverride: true,
        isActive: true,
        updatedAt: null,
        createdAt: null,
      }
    );
  }
}
