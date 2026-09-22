import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, mergeMap } from 'rxjs';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { auditEvents, campaignProspects } from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { prospectReadScope } from '../actions/action-access.js';
@Injectable()
export class ReservationHistoryInterceptor implements NestInterceptor {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{
      method: string;
      auth: AuthenticatedPrincipal;
      params: { campaignId: string; prospectId: string };
    }>();
    if (!['POST', 'DELETE'].includes(request.method)) return next.handle();
    const { auth, params } = request;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(params.campaignId) || !uuid.test(params.prospectId)) return next.handle();
    const [cp] = await this.db
      .select({ id: campaignProspects.id })
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, auth.tenantId),
          eq(campaignProspects.campaignId, params.campaignId),
          eq(campaignProspects.id, params.prospectId),
          prospectReadScope(auth, sql`${campaignProspects.id}`, true),
        ),
      );
    if (!cp) return next.handle();
    const operation = request.method === 'POST' ? 'acquire' : 'release',
      operationId = randomUUID();
    const record = async (phase: string, data: Record<string, unknown>) => {
      await this.db.insert(auditEvents).values({
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.membershipId,
        resourceType: 'campaign_prospect',
        resourceId: cp.id,
        action: `reservation.${phase}`,
        metadata: { operation, operationId, campaignId: params.campaignId, ...data },
      });
    };
    // A durable attempt survives a process failure between PostgreSQL and Redis.
    await record('requested', {});
    let resultReceived = false;
    return next.handle().pipe(
      mergeMap(async (value: Record<string, unknown>) => {
        resultReceived = true;
        await record('succeeded', {
          reservationId: value.reservationId ?? null,
          expiresAt: value.expiresAt ?? null,
        });
        return value;
      }),
      catchError(async (error: unknown) => {
        await record(resultReceived ? 'outcome_unknown' : 'failed', {
          message: 'Reservation operation or result persistence did not complete',
        });
        throw error;
      }),
    );
  }
}
