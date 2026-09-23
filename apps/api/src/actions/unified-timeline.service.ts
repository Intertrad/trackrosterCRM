import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { prospectReadScope } from './action-access.js';
@Injectable()
export class UnifiedTimelineService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async list(auth: AuthenticatedPrincipal, id: string, limit: number, cursor?: string) {
    let before: { time: string; kind: string; id: string } | undefined;
    if (cursor) {
      try {
        before = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (
          !before ||
          !Number.isFinite(Date.parse(before.time)) ||
          !/^[-a-z_]+$/.test(before.kind) ||
          !/^[0-9a-f-]{36}$/i.test(before.id)
        )
          throw new Error();
      } catch {
        throw new BadRequestException('Invalid timeline cursor');
      }
    }
    const tenantRead = sql`EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=${auth.tenantId} AND g.user_id=${auth.membershipId} AND g.scope_type='tenant' AND g.role IN ('client_admin','observer'))`;
    const visible = await this.db.execute(
      sql`SELECT e.id FROM establishments e WHERE e.tenant_id=${auth.tenantId} AND e.id=${id} AND (${tenantRead} OR EXISTS(SELECT 1 FROM campaign_prospects cp WHERE cp.tenant_id=e.tenant_id AND cp.establishment_id=e.id AND ${prospectReadScope(auth, sql`cp.id`)}))`,
    );
    if (!visible.rows.length) throw new NotFoundException('Prospect timeline not found');
    const result = await this.db.execute<{
      id: string;
      kind: string;
      occurred_at: string;
      data: Record<string, unknown>;
    }>(sql`
 WITH visible AS (SELECT cp.id FROM campaign_prospects cp WHERE cp.tenant_id=${auth.tenantId} AND cp.establishment_id=${id} AND ${prospectReadScope(auth, sql`cp.id`)}), history AS (
 SELECT e.id,'action_event'::text AS kind,e.created_at AS occurred_at,to_jsonb(e) AS data FROM action_events e JOIN actions a ON a.tenant_id=e.tenant_id AND a.id=e.action_id WHERE e.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT a.id,'activity',a.occurred_at,to_jsonb(a) FROM prospect_activities a WHERE a.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT a.id,'assignment_started',a.assigned_at,to_jsonb(a) FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT a.id,'assignment_ended',a.ended_at,to_jsonb(a) FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.ended_at IS NOT NULL AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT ae.id,'assignment_event',ae.occurred_at,jsonb_build_object('assignmentId',a.id,'action',ae.action,'reason',ae.metadata->>'reason') FROM audit_events ae JOIN campaign_prospect_assignments a ON a.tenant_id=ae.tenant_id AND a.id::text=ae.resource_id WHERE ae.tenant_id=${auth.tenantId} AND ae.resource_type='assignment' AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT ae.id,'follow_up_event',ae.occurred_at,jsonb_build_object('followUpId',f.id,'action',ae.action,'changes',ae.metadata) FROM audit_events ae JOIN prospect_follow_ups f ON f.tenant_id=ae.tenant_id AND f.id::text=ae.resource_id WHERE ae.tenant_id=${auth.tenantId} AND ae.resource_type='follow_up' AND f.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT f.id,'follow_up_created',f.created_at,to_jsonb(f) FROM prospect_follow_ups f WHERE f.tenant_id=${auth.tenantId} AND f.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT f.id,'follow_up_completed',f.completed_at,to_jsonb(f) FROM prospect_follow_ups f WHERE f.tenant_id=${auth.tenantId} AND f.completed_at IS NOT NULL AND f.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT f.id,'follow_up_cancelled',f.cancelled_at,to_jsonb(f) FROM prospect_follow_ups f WHERE f.tenant_id=${auth.tenantId} AND f.cancelled_at IS NOT NULL AND f.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT c.id,'consent',c.recorded_at,to_jsonb(c) FROM contact_consents c WHERE c.tenant_id=${auth.tenantId} AND c.prospect_id=${id} AND (EXISTS(SELECT 1 FROM visible) OR ${tenantRead})
 UNION ALL SELECT d.id,'reservation_release_requested',d.created_at,jsonb_build_object('actionId',d.action_id,'reservationId',d.payload->>'reservationId') FROM action_effects d JOIN actions a ON a.tenant_id=d.tenant_id AND a.id=d.action_id WHERE d.tenant_id=${auth.tenantId} AND d.type='release_reservation' AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT d.id,'reservation_release_processed',d.delivered_at,jsonb_build_object('actionId',d.action_id,'reservationId',d.payload->>'reservationId') FROM action_effects d JOIN actions a ON a.tenant_id=d.tenant_id AND a.id=d.action_id WHERE d.tenant_id=${auth.tenantId} AND d.type='release_reservation' AND d.delivered_at IS NOT NULL AND a.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT re.id,'reservation_evidence',re.created_at,jsonb_build_object('reservationId',re.reservation_id,'type',re.type,'data',re.data) FROM reservation_events re JOIN reservation_records rr ON rr.tenant_id=re.tenant_id AND rr.id=re.reservation_id WHERE re.tenant_id=${auth.tenantId} AND rr.campaign_prospect_id IN (SELECT id FROM visible)
 UNION ALL SELECT e.id,CASE WHEN e.action LIKE 'reservation.%' THEN 'reservation_event' ELSE 'prospect_change' END,e.occurred_at,to_jsonb(e) FROM audit_events e WHERE e.tenant_id=${auth.tenantId} AND e.resource_type='campaign_prospect' AND e.resource_id IN (SELECT id::text FROM visible) AND e.action NOT LIKE 'assignment.%'
 ) SELECT id,kind,occurred_at::text AS occurred_at,data FROM history ${before ? sql`WHERE (occurred_at,kind,id)<(${before.time}::timestamptz,${before.kind},${before.id}::uuid)` : sql``} ORDER BY history.occurred_at DESC,kind DESC,id DESC LIMIT ${limit + 1}`);
    const items = result.rows.slice(0, limit),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        result.rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                time: last.occurred_at,
                kind: last.kind,
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }
}
