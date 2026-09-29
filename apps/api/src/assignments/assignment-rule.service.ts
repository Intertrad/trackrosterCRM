import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { assignmentRules, auditEvents } from '../database/schema/index.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { AssignmentBatchService } from './assignment-batch.service.js';
import type {
  AssignmentRuleListDto,
  AssignmentRulePatchDto,
  CreateAssignmentRuleDto,
} from './assignment-batch.dto.js';
@Injectable()
export class AssignmentRuleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly batches: AssignmentBatchService,
  ) {}
  async list(a: AuthenticatedPrincipal, q: AssignmentRuleListDto) {
    await this.batches.authorize(a, q.campaignId, null);
    const rows = await this.db
      .select()
      .from(assignmentRules)
      .where(
        and(eq(assignmentRules.tenantId, a.tenantId), eq(assignmentRules.campaignId, q.campaignId)),
      )
      .orderBy(assignmentRules.priority, assignmentRules.id)
      .limit(q.limit + 1)
      .offset(q.offset);
    return {
      items: rows.slice(0, q.limit).map((r) => ({ ...r, etag: resourceETag(r) })),
      nextOffset: rows.length > q.limit ? q.offset + q.limit : null,
    };
  }
  async change(
    a: AuthenticatedPrincipal,
    op: 'create' | 'update' | 'deactivate',
    input: CreateAssignmentRuleDto | AssignmentRulePatchDto,
    id?: string,
    version?: string,
  ) {
    if (Object.entries(input).some(([key, v]) => key !== 'maxDistanceKm' && v === null))
      throw new BadRequestException('Rule fields cannot be null');
    return this.db.transaction(async (tx) => {
      await this.batches.lock(a, tx);
      const old = id ? await this.batches.rule(a, id, tx) : null;
      if (old) assertResourceMatches(version, old);
      const campaignId = old?.campaignId ?? ('campaignId' in input ? input.campaignId : undefined);
      if (!campaignId) throw new BadRequestException('Campaign required');
      const authority = await this.batches.authorize(a, campaignId, null, tx);
      const values = {
        name: old?.name,
        strategy: old?.strategy,
        targets: old?.targets,
        priority: old?.priority ?? 100,
        isActive: old?.isActive ?? true,
        requiredSkills: old?.requiredSkills ?? [],
        maxDistanceKm: old?.maxDistanceKm ?? null,
        ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      };
      if (!values.name?.trim() || !values.strategy || !values.targets?.length)
        throw new BadRequestException('Name, strategy and targets required');
      const targets = this.batches.normalize(values.targets);
      const requiredSkills = [
        ...new Set(values.requiredSkills.map((s: string) => s.toLowerCase())),
      ];
      if (op !== 'deactivate' && values.strategy === 'skill' && !requiredSkills.length)
        throw new BadRequestException('Skill rules require at least one required skill');
      if (
        op !== 'deactivate' &&
        values.strategy === 'proximity' &&
        !targets.some((t) => t.location)
      )
        throw new BadRequestException('Proximity rules require a configured dispatch location');
      // Deactivation must remain possible after a target loses eligibility or is removed.
      if (op !== 'deactivate') {
        const states = await this.batches.targets(a, authority.organization_id, targets, tx);
        if (states.some((t) => !t.eligible))
          throw new BadRequestException(
            'Rule targets must be active teams and eligible prospectors',
          );
      }
      const fields = {
        name: values.name.trim(),
        strategy: values.strategy,
        targets,
        requiredSkills,
        maxDistanceKm: values.maxDistanceKm,
        priority: values.priority,
        isActive: op === 'deactivate' ? false : values.isActive,
      };
      const [r] =
        op === 'create'
          ? await tx
              .insert(assignmentRules)
              .values({ ...fields, campaignId, tenantId: a.tenantId })
              .returning()
          : await tx
              .update(assignmentRules)
              .set({
                ...fields,
                nextTarget: input.targets || input.strategy ? 0 : old!.nextTarget,
                updatedAt: sql`clock_timestamp()`,
              })
              .where(and(eq(assignmentRules.tenantId, a.tenantId), eq(assignmentRules.id, id!)))
              .returning();
      await tx.insert(auditEvents).values({
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        resourceType: 'assignment_rule',
        resourceId: r!.id,
        action: `assignment_rule.${op}`,
        metadata: { before: old, after: r },
      });
      return { ...r!, etag: resourceETag(r!) };
    });
  }
}
