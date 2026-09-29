import { establishmentFilterConditions } from '../establishments/establishment-filters.js';
import {
  prospectCampaignMembershipQuery,
  toProspectCampaignMembership,
  type ProspectCampaignMembership,
  type ProspectCampaignMembershipRow,
} from './prospect-campaign-context.js';
import { visibleField } from '../prospect-enrichment/field-visibility.js';
import {
  customFieldDefinitions as fields,
  customFieldValues as values,
  prospectTags as tags,
  prospectTagLinks as links,
  prospectMerges as merges,
} from '../database/schema/index.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  establishments,
  establishmentContacts,
  prospectAddresses,
  regions,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { EstablishmentService } from '../establishments/establishment.service.js';
import { normalizeEstablishmentName } from '../establishments/establishment.utils.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import { masterAccess, ProspectAccessService } from './prospect-access.service.js';
import {
  AddressDto,
  CreateProspectDto,
  ListProspectsDto,
  PageDto,
  UpdateAddressDto,
  UpdateProspectDto,
} from './prospect-master.dto.js';
import { CreateEstablishmentContactDto } from '../establishment-contacts/dto/create-establishment-contact.dto.js';
import { UpdateEstablishmentContactDto } from '../establishment-contacts/dto/update-establishment-contact.dto.js';
const defined = <T extends object>(input: T) =>
  Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as T;
const clean = (v: string | null | undefined) => v?.trim() || null;
@Injectable()
export class ProspectMasterService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    readonly access: ProspectAccessService,
    private readonly audit: AuditService,
    private readonly legacy: EstablishmentService,
  ) {}
  async record(tx: DatabaseExecutor, a: AuthenticatedPrincipal, id: string, action: string) {
    await this.audit.record(
      {
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        action,
        resourceType: 'prospect',
        resourceId: id,
      },
      tx,
    );
  }
  async transaction<T>(a: AuthenticatedPrincipal, work: (tx: DatabaseExecutor) => Promise<T>) {
    try {
      return await this.db.transaction(async (tx) => {
        await this.access.lock(a, tx);
        return work(tx);
      });
    } catch (e) {
      let err: unknown = e;
      for (let i = 0; i < 6 && err && typeof err === 'object'; i++) {
        if ('code' in err && err.code === '23505')
          throw new ConflictException('A record with these unique values already exists');
        err = 'cause' in err ? err.cause : undefined;
      }
      throw e;
    }
  }
  async list(a: AuthenticatedPrincipal, q: ListProspectsDto) {
    const scope = and(
      eq(establishments.tenantId, a.tenantId),
      masterAccess(a, sql`${establishments.id}`),
      q.status !== 'all' ? eq(establishments.status, q.status) : undefined,
      /*
       * Search, section, department and commune all come from the shared helper,
       * so this listing narrows the référentiel by exactly the same rules as the
       * dispatch queue and bulk enrolment. Search widens as a result: it used to
       * read the name alone and now also reads the commune, the postcode and the
       * address, which returns more rows for a query and never fewer.
       */
      ...establishmentFilterConditions(
        {
          ...(q.search === undefined ? {} : { search: q.search }),
          ...(q.category === undefined ? {} : { category: q.category }),
          ...(q.department === undefined ? {} : { department: q.department }),
          ...(q.city === undefined ? {} : { city: q.city }),
          ...(q.regionId === undefined ? {} : { regionId: q.regionId }),
        },
        sql`establishments`,
      ),
      q.campaignId
        ? sql`EXISTS(SELECT 1 FROM campaign_prospects cp WHERE cp.tenant_id=${a.tenantId} AND cp.establishment_id=${establishments.id} AND cp.campaign_id=${q.campaignId})`
        : undefined,
    );
    const column =
      q.sort === 'createdAt' ? establishments.createdAt : establishments.normalizedName;
    let cursor: typeof establishments.$inferSelect | undefined;
    if (q.cursor) {
      [cursor] = await this.db
        .select()
        .from(establishments)
        .where(and(scope, eq(establishments.id, q.cursor)));
      if (!cursor) throw new BadRequestException('Cursor is outside this result');
    }
    const value = cursor
      ? q.sort === 'createdAt'
        ? cursor.createdAt.toISOString()
        : cursor.normalizedName
      : undefined;
    const rows = await this.db
      .select()
      .from(establishments)
      .where(
        and(
          scope,
          cursor
            ? sql`(${column},${establishments.id}) ${q.direction === 'asc' ? sql`>` : sql`<`} (${value},${cursor.id}::uuid)`
            : undefined,
        ),
      )
      .orderBy(
        q.direction === 'asc' ? asc(column) : desc(column),
        q.direction === 'asc' ? asc(establishments.id) : desc(establishments.id),
      )
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map(({ location, ...r }) => {
        void location;
        return r;
      }),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async get(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const record = await this.access.prospect(a, id, false, tx);
    const tagRows = await tx
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(links)
      .innerJoin(tags, and(eq(tags.tenantId, links.tenantId), eq(tags.id, links.tagId)))
      .where(and(eq(links.tenantId, a.tenantId), eq(links.prospectId, id)))
      .orderBy(tags.id);
    const fieldRows = await tx
      .select({ key: fields.fieldKey, value: values.value })
      .from(values)
      .innerJoin(
        fields,
        and(eq(fields.tenantId, values.tenantId), eq(fields.id, values.definitionId)),
      )
      .where(
        and(
          eq(values.tenantId, a.tenantId),
          eq(values.prospectId, id),
          eq(fields.isActive, true),
          visibleField(a),
        ),
      )
      .orderBy(fields.fieldKey);
    const merged = await tx
      .select()
      .from(merges)
      .where(
        and(
          eq(merges.tenantId, a.tenantId),
          sql`(${merges.sourceId}=${id}::uuid OR ${merges.targetId}=${id}::uuid)`,
        ),
      );
    return {
      ...record,
      tags: tagRows,
      customFields: Object.fromEntries(fieldRows.map((r) => [r.key, r.value])),
      mergedIntoId: merged.find((r) => r.sourceId === id)?.targetId ?? null,
      mergedSourceIds: merged
        .filter((r) => r.targetId === id)
        .map((r) => r.sourceId)
        .sort(),
    };
  }
  /*
   * The campaigns that hold this establishment, and what each one has made of it.
   *
   * Two gates, deliberately. The establishment itself is checked first through the
   * same access the detail endpoint uses, so an establishment the caller may not
   * see answers 404 and discloses nothing. Each membership is then filtered on its
   * own: being able to see the establishment does not mean being able to see every
   * campaign in the tenant, and a director of one entity must not learn what
   * another entity is working.
   *
   * An establishment with no membership is an empty list, not a 404 — it exists and
   * nobody has enrolled it, which is a normal state for most of the référentiel.
   */
  async campaignMemberships(
    a: AuthenticatedPrincipal,
    id: string,
  ): Promise<{ items: ProspectCampaignMembership[] }> {
    await this.access.prospect(a, id, false);

    const rows = await this.db.execute<ProspectCampaignMembershipRow>(
      prospectCampaignMembershipQuery(a, id),
    );

    return { items: rows.rows.map(toProspectCampaignMembership) };
  }

  create(a: AuthenticatedPrincipal, input: CreateProspectDto) {
    return this.transaction(a, async (tx) => {
      await this.access.admin(a, tx);
      const r = await this.legacy.create({ tenantId: a.tenantId, ...input, source: 'manual' }, tx);
      if (r.addressLine1)
        await tx.insert(prospectAddresses).values({
          tenantId: a.tenantId,
          prospectId: r.id,
          line1: r.addressLine1,
          postalCode: r.postalCode,
          city: r.city,
          countryCode: r.countryCode,
          latitude: r.latitude,
          longitude: r.longitude,
          isPrimary: true,
        });
      await this.record(tx, a, r.id, 'prospect.created');
      return this.get(a, r.id, tx);
    });
  }
  async update(
    a: AuthenticatedPrincipal,
    id: string,
    input: UpdateProspectDto,
    version?: string,
    transition?: 'archived' | 'active',
  ) {
    return this.transaction(a, async (tx) => {
      await tx
        .select({ id: establishments.id })
        .from(establishments)
        .where(and(eq(establishments.tenantId, a.tenantId), eq(establishments.id, id)))
        .for('update');
      const current = await this.access.prospect(a, id, true, tx);
      assertResourceMatches(version, await this.get(a, id, tx));
      if (!transition && input.status !== undefined)
        throw new BadRequestException('Use archive or restore for prospect status changes');
      if (!transition && current.status === 'archived')
        throw new ConflictException('Restore the prospect before editing');
      if (!transition && !Object.keys(defined(input)).length)
        throw new BadRequestException('At least one field is required');
      if (transition === 'archived') {
        const open = await tx.execute(
          sql`SELECT 1 FROM campaign_prospects p WHERE p.tenant_id=${a.tenantId} AND p.establishment_id=${id} AND (EXISTS(SELECT 1 FROM campaign_prospect_assignments aa WHERE aa.tenant_id=p.tenant_id AND aa.campaign_prospect_id=p.id AND aa.ended_at IS NULL) OR EXISTS(SELECT 1 FROM actions ac WHERE ac.tenant_id=p.tenant_id AND ac.campaign_prospect_id=p.id AND ac.status IN ('planned','started')) OR EXISTS(SELECT 1 FROM prospect_follow_ups f WHERE f.tenant_id=p.tenant_id AND f.campaign_prospect_id=p.id AND f.status='pending') OR EXISTS(SELECT 1 FROM reservation_records r WHERE r.tenant_id=p.tenant_id AND r.campaign_prospect_id=p.id AND r.status IN ('pending','active') AND r.expires_at>now()) OR EXISTS(SELECT 1 FROM override_requests r WHERE r.tenant_id=p.tenant_id AND r.campaign_prospect_id=p.id AND r.status='pending')) LIMIT 1`,
        );
        if (open.rows.length)
          throw new ConflictException('Resolve open prospect work before archival');
      }
      const next = { ...current, ...defined(input), status: transition ?? current.status };
      if (
        typeof next.name !== 'string' ||
        !next.name.trim() ||
        typeof next.countryCode !== 'string'
      )
        throw new BadRequestException('Name and country are required');
      if ((next.latitude == null) !== (next.longitude == null))
        throw new BadRequestException('Coordinates must be provided together');
      if (next.regionId) {
        const [r] = await tx
          .select()
          .from(regions)
          .where(
            and(
              eq(regions.tenantId, a.tenantId),
              eq(regions.id, next.regionId),
              eq(regions.status, 'active'),
            ),
          );
        if (!r) throw new NotFoundException('Active region not found');
      }
      const { id: _id, tenantId: _tenant, createdAt: _created, ...fields } = next;
      void _id;
      void _tenant;
      void _created;
      await tx
        .update(establishments)
        .set({
          ...fields,
          name: next.name.trim(),
          normalizedName: normalizeEstablishmentName(next.name),
          countryCode: next.countryCode.toUpperCase(),
          updatedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(establishments.tenantId, a.tenantId), eq(establishments.id, id)));
      await this.record(
        tx,
        a,
        id,
        transition === 'archived'
          ? 'prospect.archived'
          : transition
            ? 'prospect.restored'
            : 'prospect.updated',
      );
      return this.get(a, id, tx);
    });
  }
  async childParent(
    a: AuthenticatedPrincipal,
    kind: 'address' | 'contact',
    id: string,
    write = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const r =
      kind === 'address'
        ? (
            await tx
              .select({ parent: prospectAddresses.prospectId })
              .from(prospectAddresses)
              .where(
                and(
                  eq(prospectAddresses.tenantId, a.tenantId),
                  eq(prospectAddresses.id, id),
                  isNull(prospectAddresses.deletedAt),
                ),
              )
          )[0]
        : (
            await tx
              .select({ parent: establishmentContacts.establishmentId })
              .from(establishmentContacts)
              .where(
                and(
                  eq(establishmentContacts.tenantId, a.tenantId),
                  eq(establishmentContacts.id, id),
                  eq(establishmentContacts.status, 'active'),
                ),
              )
          )[0];
    if (!r) throw new NotFoundException('Record not found');
    await this.access.prospect(a, r.parent, write, tx);
    return r.parent;
  }
  async children(a: AuthenticatedPrincipal, id: string, kind: 'address' | 'contact', q: PageDto) {
    await this.access.prospect(a, id);
    const rows =
      kind === 'address'
        ? await this.db
            .select()
            .from(prospectAddresses)
            .where(
              and(
                eq(prospectAddresses.tenantId, a.tenantId),
                eq(prospectAddresses.prospectId, id),
                isNull(prospectAddresses.deletedAt),
                q.cursor ? gt(prospectAddresses.id, q.cursor) : undefined,
              ),
            )
            .orderBy(prospectAddresses.id)
            .limit(q.limit + 1)
        : await this.db
            .select()
            .from(establishmentContacts)
            .where(
              and(
                eq(establishmentContacts.tenantId, a.tenantId),
                eq(establishmentContacts.establishmentId, id),
                eq(establishmentContacts.status, 'active'),
                q.cursor ? gt(establishmentContacts.id, q.cursor) : undefined,
              ),
            )
            .orderBy(establishmentContacts.id)
            .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  address(
    a: AuthenticatedPrincipal,
    parent: string | undefined,
    id: string | undefined,
    input: AddressDto | UpdateAddressDto,
    remove = false,
    version?: string,
  ) {
    return this.transaction(a, async (tx) => {
      const pid = parent ?? (await this.childParent(a, 'address', id!, true, tx));
      const prospect = await this.access.prospect(a, pid, true, tx);
      if (prospect.status === 'archived') throw new ConflictException('Prospect is archived');
      const current = id
        ? (
            await tx
              .select()
              .from(prospectAddresses)
              .where(and(eq(prospectAddresses.tenantId, a.tenantId), eq(prospectAddresses.id, id)))
          )[0]
        : undefined;
      if (current) assertResourceMatches(version, current);
      const data = { ...current, ...defined(input) };
      if (current?.isPrimary && input.isPrimary === false && !remove)
        throw new BadRequestException('Choose another primary address or delete this address');
      if ((data.latitude == null) !== (data.longitude == null))
        throw new BadRequestException('Coordinates must be provided together');
      if (id && !remove && !Object.keys(defined(input)).length)
        throw new BadRequestException('At least one field is required');
      if (data.isPrimary && !remove)
        await tx
          .update(prospectAddresses)
          .set({ isPrimary: false, updatedAt: sql`clock_timestamp()` })
          .where(
            and(eq(prospectAddresses.tenantId, a.tenantId), eq(prospectAddresses.prospectId, pid)),
          );
      const changes = {
        ...input,
        countryCode: data.countryCode?.toUpperCase(),
        ...(remove ? { deletedAt: new Date(), isPrimary: false } : {}),
        updatedAt: sql`clock_timestamp()`,
      };
      const [r] = id
        ? await tx
            .update(prospectAddresses)
            .set(changes)
            .where(and(eq(prospectAddresses.tenantId, a.tenantId), eq(prospectAddresses.id, id)))
            .returning()
        : await tx
            .insert(prospectAddresses)
            .values({
              ...input,
              line1: data.line1!,
              countryCode: data.countryCode!.toUpperCase(),
              tenantId: a.tenantId,
              prospectId: pid,
            })
            .returning();
      if (r?.isPrimary || (current?.isPrimary && remove))
        await tx
          .update(establishments)
          .set({
            addressLine1: remove ? null : r!.line1,
            postalCode: remove ? null : r!.postalCode,
            city: remove ? null : r!.city,
            latitude: remove ? null : r!.latitude,
            longitude: remove ? null : r!.longitude,
            ...(!remove ? { countryCode: r!.countryCode } : {}),
            updatedAt: sql`clock_timestamp()`,
          })
          .where(and(eq(establishments.tenantId, a.tenantId), eq(establishments.id, pid)));
      await this.record(
        tx,
        a,
        pid,
        remove
          ? 'prospect.address_deleted'
          : id
            ? 'prospect.address_updated'
            : 'prospect.address_created',
      );
      return r;
    });
  }
  contact(
    a: AuthenticatedPrincipal,
    parent: string | undefined,
    id: string | undefined,
    input: CreateEstablishmentContactDto | UpdateEstablishmentContactDto,
    remove = false,
    version?: string,
  ) {
    return this.transaction(a, async (tx) => {
      const pid = parent ?? (await this.childParent(a, 'contact', id!, true, tx));
      const prospect = await this.access.prospect(a, pid, true, tx);
      if (prospect.status === 'archived') throw new ConflictException('Prospect is archived');
      const current = id
        ? (
            await tx
              .select()
              .from(establishmentContacts)
              .where(
                and(
                  eq(establishmentContacts.tenantId, a.tenantId),
                  eq(establishmentContacts.id, id),
                ),
              )
          )[0]
        : undefined;
      if (current) assertResourceMatches(version, current);
      if (input.isPrimary === null || ('status' in input && input.status !== undefined))
        throw new BadRequestException('Use DELETE to archive contacts');
      const next = { ...current, ...defined(input) };
      const data = {
        name: clean(next.name),
        email: clean(next.email)?.toLowerCase() ?? null,
        phone: clean(next.phone),
        jobTitle: clean(next.jobTitle),
        isPrimary: remove ? false : (next.isPrimary ?? false),
        status: remove ? ('archived' as const) : ('active' as const),
      };
      if (!data.name && !data.email && !data.phone)
        throw new BadRequestException('Contact requires name, email, or phone');
      if (id && !remove && !Object.keys(defined(input)).length)
        throw new BadRequestException('At least one field is required');
      if (data.isPrimary)
        await tx
          .update(establishmentContacts)
          .set({ isPrimary: false, updatedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(establishmentContacts.tenantId, a.tenantId),
              eq(establishmentContacts.establishmentId, pid),
            ),
          );
      const [r] = id
        ? await tx
            .update(establishmentContacts)
            .set({ ...data, updatedAt: sql`clock_timestamp()` })
            .where(
              and(eq(establishmentContacts.tenantId, a.tenantId), eq(establishmentContacts.id, id)),
            )
            .returning()
        : await tx
            .insert(establishmentContacts)
            .values({ ...data, tenantId: a.tenantId, establishmentId: pid, source: 'manual' })
            .returning();
      await this.record(
        tx,
        a,
        pid,
        remove
          ? 'prospect.contact_deleted'
          : id
            ? 'prospect.contact_updated'
            : 'prospect.contact_created',
      );
      return r;
    });
  }
}
