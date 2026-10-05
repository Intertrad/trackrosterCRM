import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { outcomeSettings, tenants, auditEvents } from '../database/schema/index.js';
import type { OutcomeDefinition } from '../database/schema/outcome-settings.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { resourceETag, assertResourceMatches } from '../http/resource-etag.js';
export const BEHAVIORS = [
  'no_answer',
  'contacted',
  'interested',
  'not_interested',
  'qualified',
  'converted',
  'do_not_contact',
  'completed',
] as const;
export const ACTION_TYPES = ['call', 'email', 'message', 'visit', 'task', 'note'];
export const DEFAULT_OUTCOMES: OutcomeDefinition[] = BEHAVIORS.map((code) => ({
  code,
  label: code.replaceAll('_', ' '),
  behavior: code,
  enabled: true,
  actionTypes: code === 'completed' ? ['task', 'note'] : ['call', 'email', 'message', 'visit'],
}));
export async function readOutcomes(tx: DatabaseExecutor, tenantId: string) {
  const [row] = await tx
    .select()
    .from(outcomeSettings)
    .where(eq(outcomeSettings.tenantId, tenantId));
  return row ?? { tenantId, outcomes: DEFAULT_OUTCOMES, updatedAt: null };
}
export async function resolveOutcome(
  tx: DatabaseExecutor,
  tenantId: string,
  code: string,
  type: string,
) {
  const { outcomes } = await readOutcomes(tx, tenantId);
  const outcome = outcomes.find(
    (o) =>
      o.code === code &&
      o.enabled &&
      /* An empty channel list is the documented tenant-wide outcome. */
      (o.actionTypes.length === 0 || o.actionTypes.includes(type)),
  );
  if (!outcome) throw new BadRequestException('Outcome is unavailable for this action type');
  return outcome;
}
@Injectable()
export class OutcomeSettingsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async authorize(a: AuthenticatedPrincipal, tx: DatabaseExecutor = this.db) {
    const result = await tx.execute(
      sql`SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id JOIN user_access_grants g ON g.tenant_id=m.tenant_id AND g.user_id=m.id WHERE m.tenant_id=${a.tenantId} AND m.id=${a.membershipId} AND m.status='active' AND i.status='active' AND g.role='client_admin' AND g.scope_type='tenant'`,
    );
    if (!result.rows.length) throw new ForbiddenException('Tenant administrator required');
  }
  async read(a: AuthenticatedPrincipal) {
    const config = await readOutcomes(this.db, a.tenantId);
    return {
      ...config,
      etag: resourceETag(config),
      lifecycleStages: [
        'to_contact',
        'contact_made',
        'in_progress',
        'follow_up',
        'qualified',
        'converted',
      ],
    };
  }
  async update(a: AuthenticatedPrincipal, outcomes: OutcomeDefinition[], version?: string) {
    const codes = new Set(outcomes.map((o) => o.code));
    if (codes.size !== outcomes.length)
      throw new BadRequestException('Outcome codes must be unique');
    for (const o of outcomes) {
      if (BEHAVIORS.includes(o.code as (typeof BEHAVIORS)[number]) && o.behavior !== o.code)
        throw new BadRequestException('Built-in outcome semantics cannot change');
      if (o.actionTypes.some((t) => ['task', 'note'].includes(t) !== (o.behavior === 'completed')))
        throw new BadRequestException('Completed behavior is limited to tasks and notes');
    }
    for (const type of ACTION_TYPES)
      if (!outcomes.some((o) => o.enabled && o.actionTypes.includes(type)))
        throw new BadRequestException('Every action type requires an enabled outcome');
    for (const type of ['call', 'email', 'message', 'visit'])
      if (
        !outcomes.some(
          (o) => o.enabled && o.behavior === 'do_not_contact' && o.actionTypes.includes(type),
        )
      )
        throw new BadRequestException('Opposition must remain available for every contact channel');
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, a.tenantId))
        .for('no key update');
      await this.authorize(a, tx);
      const previous = await readOutcomes(tx, a.tenantId);
      assertResourceMatches(version, previous);
      const [next] = await tx
        .insert(outcomeSettings)
        .values({ tenantId: a.tenantId, outcomes })
        .onConflictDoUpdate({
          target: outcomeSettings.tenantId,
          set: { outcomes, updatedAt: sql`clock_timestamp()` },
        })
        .returning();
      await tx.insert(auditEvents).values({
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        resourceType: 'outcome_settings',
        resourceId: a.tenantId,
        action: 'outcome_settings.updated',
        metadata: { before: previous.outcomes, after: outcomes },
      });
      return { ...next, etag: resourceETag(next) };
    });
  }
}
