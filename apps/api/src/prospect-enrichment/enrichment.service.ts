import { visibleField } from './field-visibility.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import {
  customFieldDefinitions as fields,
  customFieldValues as values,
  prospectTags as tags,
  prospectTagLinks as links,
  prospectDuplicates as duplicates,
  prospectMerges as merges,
  establishments,
  prospectAddresses,
  establishmentContacts,
} from '../database/schema/index.js';
import { ProspectAccessService, masterAccess } from '../prospect-master/prospect-access.service.js';
import { ProspectMasterService } from '../prospect-master/prospect-master.service.js';
import { PageDto } from '../prospect-master/prospect-master.dto.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import {
  DuplicateQueryDto,
  FieldDto,
  FieldValuesDto,
  ResolveDuplicateDto,
  TagDto,
  UpdateFieldDto,
  UpdateTagDto,
} from './enrichment.dto.js';
import { validateFieldDefinition, validateFieldValue } from './custom-field-validation.js';
@Injectable()
export class EnrichmentService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly access: ProspectAccessService,
    private readonly master: ProspectMasterService,
  ) {}
  page<T extends { id: string }>(rows: T[], q: PageDto) {
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async tagList(a: AuthenticatedPrincipal, q: PageDto) {
    return this.page(
      await this.db
        .select()
        .from(tags)
        .where(and(eq(tags.tenantId, a.tenantId), q.cursor ? gt(tags.id, q.cursor) : undefined))
        .orderBy(tags.id)
        .limit(q.limit + 1),
      q,
    );
  }
  tagWrite(
    a: AuthenticatedPrincipal,
    id: string | undefined,
    d: TagDto | UpdateTagDto,
    remove = false,
    v?: string,
  ) {
    return this.master.transaction(a, async (tx) => {
      await this.access.admin(a, tx);
      const current = id
        ? (
            await tx
              .select()
              .from(tags)
              .where(and(eq(tags.tenantId, a.tenantId), eq(tags.id, id)))
          )[0]
        : undefined;
      if (id && !current) throw new NotFoundException('Tag not found');
      if (current) assertResourceMatches(v, current);
      if (remove) {
        const [used] = await tx
          .select()
          .from(links)
          .where(and(eq(links.tenantId, a.tenantId), eq(links.tagId, id!)))
          .limit(1);
        if (used) throw new ConflictException('Remove tag assignments before deleting this tag');
        await tx.delete(tags).where(and(eq(tags.tenantId, a.tenantId), eq(tags.id, id!)));
        await this.master.record(tx, a, id!, 'tag.deleted');
        return;
      }
      if (!Object.values(d).some((x) => x !== undefined))
        throw new BadRequestException('At least one field is required');
      const [r] = id
        ? await tx
            .update(tags)
            .set({ ...d, updatedAt: sql`clock_timestamp()` })
            .where(and(eq(tags.tenantId, a.tenantId), eq(tags.id, id)))
            .returning()
        : await tx
            .insert(tags)
            .values({ tenantId: a.tenantId, name: d.name!, color: d.color })
            .returning();
      await this.master.record(tx, a, r!.id, id ? 'tag.updated' : 'tag.created');
      return r;
    });
  }
  tagProspect(a: AuthenticatedPrincipal, pid: string, tagId: string, remove = false) {
    return this.master.transaction(a, async (tx) => {
      const p = await this.access.prospect(a, pid, true, tx);
      if (p.status === 'archived') throw new ConflictException('Prospect is archived');
      const [tag] = await tx
        .select()
        .from(tags)
        .where(and(eq(tags.tenantId, a.tenantId), eq(tags.id, tagId)));
      if (!tag) throw new NotFoundException('Tag not found');
      if (remove)
        await tx
          .delete(links)
          .where(
            and(eq(links.tenantId, a.tenantId), eq(links.prospectId, pid), eq(links.tagId, tagId)),
          );
      else
        await tx
          .insert(links)
          .values({ tenantId: a.tenantId, prospectId: pid, tagId })
          .onConflictDoNothing();
      await this.master.record(tx, a, pid, remove ? 'prospect.tag_removed' : 'prospect.tag_added');
      return { prospectId: pid, tagId };
    });
  }
  async fieldList(a: AuthenticatedPrincipal, q: PageDto) {
    return this.page(
      await this.db
        .select()
        .from(fields)
        .where(
          and(
            eq(fields.tenantId, a.tenantId),
            eq(fields.isActive, true),
            visibleField(a),
            q.cursor ? gt(fields.id, q.cursor) : undefined,
          ),
        )
        .orderBy(fields.id)
        .limit(q.limit + 1),
      q,
    );
  }
  fieldWrite(
    a: AuthenticatedPrincipal,
    id: string | undefined,
    d: FieldDto | UpdateFieldDto,
    remove = false,
    v?: string,
  ) {
    return this.master.transaction(a, async (tx) => {
      await this.access.admin(a, tx);
      const current = id
        ? (
            await tx
              .select()
              .from(fields)
              .where(and(eq(fields.tenantId, a.tenantId), eq(fields.id, id)))
          )[0]
        : undefined;
      if (id && !current) throw new NotFoundException('Field not found');
      if (current) assertResourceMatches(v, current);
      const defined = Object.fromEntries(Object.entries(d).filter(([, x]) => x !== undefined));
      const next = {
        ...current,
        ...defined,
        validation: d.validation ?? current?.validation ?? {},
        visibility: d.visibility ?? current?.visibility ?? {},
      } as typeof fields.$inferSelect;
      if (!remove) {
        if (!Object.keys(defined).length)
          throw new BadRequestException('At least one field is required');
        validateFieldDefinition(next);
        if (id && d.validation) {
          const cursorRows = await tx
            .select({ value: values.value })
            .from(values)
            .where(and(eq(values.tenantId, a.tenantId), eq(values.definitionId, id)))
            .limit(10001);
          if (cursorRows.length > 10000)
            throw new ConflictException(
              'Field validation changes require a data migration for more than 10000 existing values',
            );
          for (const r of cursorRows) {
            try {
              validateFieldValue(next, r.value);
            } catch {
              throw new ConflictException('Validation would invalidate existing field values');
            }
          }
        }
      }
      const [r] = id
        ? await tx
            .update(fields)
            .set({
              ...defined,
              ...(remove ? { isActive: false } : {}),
              updatedAt: sql`clock_timestamp()`,
            })
            .where(and(eq(fields.tenantId, a.tenantId), eq(fields.id, id)))
            .returning()
        : await tx
            .insert(fields)
            .values({
              tenantId: a.tenantId,
              fieldKey: (d as FieldDto).fieldKey,
              label: d.label!,
              dataType: (d as FieldDto).dataType,
              validation: next.validation,
              visibility: next.visibility,
            })
            .returning();
      await this.master.record(
        tx,
        a,
        r!.id,
        remove ? 'custom_field.deactivated' : id ? 'custom_field.updated' : 'custom_field.created',
      );
      return r;
    });
  }
  values(a: AuthenticatedPrincipal, pid: string, d: FieldValuesDto) {
    return this.master.transaction(a, async (tx) => {
      const p = await this.access.prospect(a, pid, true, tx);
      if (p.status === 'archived') throw new ConflictException('Prospect is archived');
      const entries = Object.entries(d.values);
      if (entries.length > 100 || JSON.stringify(d.values).length > 100000)
        throw new BadRequestException('At most 100 fields and 100000 characters are allowed');
      const allowed = await tx
        .select()
        .from(fields)
        .where(and(eq(fields.tenantId, a.tenantId), eq(fields.isActive, true), visibleField(a)));
      const byKey = new Map(allowed.map((f) => [f.fieldKey, f]));
      for (const [key, value] of entries) {
        const f = byKey.get(key);
        if (!f) throw new BadRequestException('Unknown, inactive or hidden field');
        validateFieldValue(f, value);
        if (value === null)
          await tx
            .delete(values)
            .where(
              and(
                eq(values.tenantId, a.tenantId),
                eq(values.prospectId, pid),
                eq(values.definitionId, f.id),
              ),
            );
        else
          await tx
            .insert(values)
            .values({
              tenantId: a.tenantId,
              prospectId: pid,
              definitionId: f.id,
              value,
              updatedBy: a.membershipId,
            })
            .onConflictDoUpdate({
              target: [values.tenantId, values.prospectId, values.definitionId],
              set: { value, updatedBy: a.membershipId, updatedAt: sql`clock_timestamp()` },
            });
      }
      await this.master.record(tx, a, pid, 'prospect.custom_fields_updated');
      return this.metadata(a, pid, tx);
    });
  }
  async metadata(a: AuthenticatedPrincipal, pid: string, tx: DatabaseExecutor = this.db) {
    const ts = await tx
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(links)
      .innerJoin(tags, and(eq(tags.tenantId, links.tenantId), eq(tags.id, links.tagId)))
      .where(and(eq(links.tenantId, a.tenantId), eq(links.prospectId, pid)))
      .orderBy(tags.id);
    const vs = await tx
      .select({ key: fields.fieldKey, value: values.value })
      .from(values)
      .innerJoin(
        fields,
        and(eq(fields.tenantId, values.tenantId), eq(fields.id, values.definitionId)),
      )
      .where(
        and(
          eq(values.tenantId, a.tenantId),
          eq(values.prospectId, pid),
          eq(fields.isActive, true),
          visibleField(a),
        ),
      );
    return { tags: ts, customFields: Object.fromEntries(vs.map((r) => [r.key, r.value])) };
  }
  async duplicateList(a: AuthenticatedPrincipal, q: DuplicateQueryDto) {
    return this.page(
      await this.db
        .select()
        .from(duplicates)
        .where(
          and(
            eq(duplicates.tenantId, a.tenantId),
            masterAccess(a, sql`${duplicates.leftProspectId}`),
            masterAccess(a, sql`${duplicates.rightProspectId}`),
            q.resolution === 'all' ? undefined : eq(duplicates.resolution, q.resolution),
            q.cursor ? gt(duplicates.id, q.cursor) : undefined,
          ),
        )
        .orderBy(duplicates.id)
        .limit(q.limit + 1),
      q,
    );
  }
  async duplicate(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [r] = await tx
      .select()
      .from(duplicates)
      .where(
        and(
          eq(duplicates.tenantId, a.tenantId),
          eq(duplicates.id, id),
          masterAccess(a, sql`${duplicates.leftProspectId}`),
          masterAccess(a, sql`${duplicates.rightProspectId}`),
        ),
      );
    if (!r) throw new NotFoundException('Duplicate candidate not found');
    return {
      ...r,
      left: await this.access.prospect(a, r.leftProspectId, false, tx),
      right: await this.access.prospect(a, r.rightProspectId, false, tx),
    };
  }
  resolve(a: AuthenticatedPrincipal, id: string, d: ResolveDuplicateDto) {
    return this.master.transaction(a, async (tx) => {
      await this.access.admin(a, tx);
      const r = await this.duplicate(a, id, tx);
      if (r.resolution !== 'pending') throw new ConflictException('Candidate is already resolved');
      if (d.resolution === 'merged') {
        if (![r.leftProspectId, r.rightProspectId].includes(d.targetId ?? ''))
          throw new BadRequestException('targetId must identify one candidate');
        const target = d.targetId!,
          source = target === r.leftProspectId ? r.rightProspectId : r.leftProspectId;
        await tx
          .select({ id: establishments.id })
          .from(establishments)
          .where(
            and(
              eq(establishments.tenantId, a.tenantId),
              sql`${establishments.id} IN (${source}::uuid,${target}::uuid)`,
            ),
          )
          .orderBy(establishments.id)
          .for('update');
        const [existing] = await tx
          .select()
          .from(merges)
          .where(
            and(
              eq(merges.tenantId, a.tenantId),
              sql`(${merges.sourceId} IN (${source}::uuid,${target}::uuid) OR ${merges.targetId}=${source}::uuid)`,
            ),
          )
          .limit(1);
        if (existing || r.left.status === 'archived' || r.right.status === 'archived')
          throw new ConflictException('Candidates must be active, unmerged records');
        // Historical campaign rows keep their original IDs and references. The source becomes an immutable alias.
        const open = await tx.execute(
          sql`SELECT 1 FROM campaign_prospect_assignments aa JOIN campaign_prospects cp ON cp.tenant_id=aa.tenant_id AND cp.id=aa.campaign_prospect_id WHERE cp.tenant_id=${a.tenantId} AND cp.establishment_id=${source} AND aa.ended_at IS NULL UNION ALL SELECT 1 FROM actions WHERE tenant_id=${a.tenantId} AND establishment_id=${source} AND status IN ('planned','started') UNION ALL SELECT 1 FROM prospect_follow_ups WHERE tenant_id=${a.tenantId} AND establishment_id=${source} AND status='pending' UNION ALL SELECT 1 FROM reservation_records WHERE tenant_id=${a.tenantId} AND establishment_id=${source} AND status IN ('active','pending') AND expires_at>now() UNION ALL SELECT 1 FROM override_requests o JOIN campaign_prospects cp ON cp.tenant_id=o.tenant_id AND cp.id=o.campaign_prospect_id WHERE cp.tenant_id=${a.tenantId} AND cp.establishment_id=${source} AND o.status='pending' LIMIT 1`,
        );
        if (open.rows.length)
          throw new ConflictException('Resolve source operational work before merging');
        const conflicts = await tx.execute(
          sql`SELECT 1 FROM establishment_contacts s JOIN establishment_contacts t ON t.tenant_id=s.tenant_id AND t.email=s.email WHERE s.tenant_id=${a.tenantId} AND s.establishment_id=${source} AND t.establishment_id=${target} AND s.email IS NOT NULL UNION ALL SELECT 1 FROM prospect_custom_field_values s JOIN prospect_custom_field_values t ON t.tenant_id=s.tenant_id AND t.definition_id=s.definition_id WHERE s.tenant_id=${a.tenantId} AND s.prospect_id=${source} AND t.prospect_id=${target} AND s.value<>t.value LIMIT 1`,
        );
        if (conflicts.rows.length)
          throw new ConflictException(
            'Resolve duplicate contact emails or conflicting custom values before merging',
          );
        await tx.insert(merges).values({
          tenantId: a.tenantId,
          sourceId: source,
          targetId: target,
          mergedBy: a.membershipId,
        });
        await tx
          .update(establishments)
          .set({ status: 'archived', updatedAt: sql`clock_timestamp()` })
          .where(and(eq(establishments.tenantId, a.tenantId), eq(establishments.id, source)));
        await tx
          .update(prospectAddresses)
          .set({ prospectId: target, isPrimary: false, updatedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(prospectAddresses.tenantId, a.tenantId),
              eq(prospectAddresses.prospectId, source),
            ),
          );
        await tx
          .update(establishmentContacts)
          .set({ establishmentId: target, isPrimary: false, updatedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(establishmentContacts.tenantId, a.tenantId),
              eq(establishmentContacts.establishmentId, source),
            ),
          );
        await tx.execute(
          sql`INSERT INTO prospect_tags(tenant_id,prospect_id,tag_id) SELECT tenant_id,${target}::uuid,tag_id FROM prospect_tags WHERE tenant_id=${a.tenantId} AND prospect_id=${source} ON CONFLICT DO NOTHING`,
        );
        await tx.execute(
          sql`INSERT INTO prospect_custom_field_values(tenant_id,prospect_id,definition_id,value,updated_by) SELECT tenant_id,${target}::uuid,definition_id,value,${a.membershipId}::uuid FROM prospect_custom_field_values WHERE tenant_id=${a.tenantId} AND prospect_id=${source} ON CONFLICT DO NOTHING`,
        );
        await this.master.record(tx, a, target, 'prospect.merged');
      }
      await tx
        .update(duplicates)
        .set({
          resolution: d.resolution,
          resolvedBy: a.membershipId,
          resolvedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(duplicates.tenantId, a.tenantId), eq(duplicates.id, id)));
      await this.master.record(tx, a, id, 'prospect_duplicate.resolved');
      return this.duplicate(a, id, tx);
    });
  }
  async quality(a: AuthenticatedPrincipal) {
    const r = await this.db.execute(
      sql`WITH visible AS MATERIALIZED(SELECT * FROM establishments WHERE tenant_id=${a.tenantId} AND status='active' AND ${masterAccess(a, sql`establishments.id`)}) SELECT count(*)::int AS total,count(*) FILTER(WHERE address_line1 IS NULL OR city IS NULL OR postal_code IS NULL)::int AS missing_address,count(*) FILTER(WHERE latitude IS NULL OR longitude IS NULL)::int AS missing_coordinates,count(*) FILTER(WHERE phone IS NULL AND NOT EXISTS(SELECT 1 FROM establishment_contacts c WHERE c.tenant_id=${a.tenantId} AND c.establishment_id=visible.id AND c.status='active' AND (c.email IS NOT NULL OR c.phone IS NOT NULL)))::int AS missing_contact,(SELECT count(*)::int FROM prospect_duplicates d WHERE d.tenant_id=${a.tenantId} AND d.resolution='pending' AND d.left_prospect_id IN(SELECT id FROM visible) AND d.right_prospect_id IN(SELECT id FROM visible)) AS pending_duplicates FROM visible`,
    );
    return r.rows[0];
  }
}
