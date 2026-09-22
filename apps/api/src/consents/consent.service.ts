import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  contactConsents,
  establishments,
  establishmentContacts,
  tenants,
} from '../database/schema/index.js';
import { consentAccess } from './consent-access.js';
import type { CreateConsentDto, ListConsentsDto } from './consent.dto.js';
@Injectable()
export class ConsentService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async authorize(
    auth: AuthenticatedPrincipal,
    id: string,
    write = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const rows = await tx
      .select({ id: establishments.id })
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, auth.tenantId),
          eq(establishments.id, id),
          consentAccess(auth.tenantId, auth.membershipId, id, write),
        ),
      );
    if (!rows.length) throw new NotFoundException('Prospect not found');
  }
  async list(auth: AuthenticatedPrincipal, id: string, q: ListConsentsDto) {
    await this.authorize(auth, id);
    const rows = await this.db
      .select()
      .from(contactConsents)
      .where(
        and(
          eq(contactConsents.tenantId, auth.tenantId),
          eq(contactConsents.prospectId, id),
          consentAccess(auth.tenantId, auth.membershipId, id),
          q.cursor ? gt(contactConsents.id, q.cursor) : undefined,
        ),
      )
      .orderBy(contactConsents.id)
      .limit(q.limit + 1);
    const effective = await this.db.execute<{ channel: string; blocked: boolean }>(
      sql`SELECT channel,trackroster_consent_blocked(${auth.tenantId}::uuid,${id}::uuid,channel) AS blocked FROM unnest(ARRAY['phone','email','sms','visit']) AS channel`,
    );
    return {
      items: rows.slice(0, q.limit),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
      restrictions: effective.rows,
    };
  }
  async append(auth: AuthenticatedPrincipal, id: string, input: CreateConsentDto) {
    const effectiveAt = input.effectiveAt ? new Date(input.effectiveAt) : new Date(),
      expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= effectiveAt)
      throw new BadRequestException('expiresAt must follow effectiveAt');
    const evidence = input.evidence ?? {};
    if (
      Object.keys(evidence).length > 20 ||
      Object.values(evidence).some((v) => typeof v !== 'string' || v.length > 2000) ||
      JSON.stringify(evidence).length > 12000
    )
      throw new BadRequestException(
        'Evidence must contain at most 20 short string values and 12000 characters',
      );
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .for('no key update');
      await this.authorize(auth, id, true, tx);
      await tx
        .select({ id: establishments.id })
        .from(establishments)
        .where(and(eq(establishments.tenantId, auth.tenantId), eq(establishments.id, id)))
        .for('update');
      if (input.contactId) {
        const rows = await tx
          .select({ id: establishmentContacts.id })
          .from(establishmentContacts)
          .where(
            and(
              eq(establishmentContacts.tenantId, auth.tenantId),
              eq(establishmentContacts.establishmentId, id),
              eq(establishmentContacts.id, input.contactId),
            ),
          )
          .for('share');
        if (!rows.length) throw new NotFoundException('Contact not found for this prospect');
      }
      const [after] = await tx
        .insert(contactConsents)
        .values({
          tenantId: auth.tenantId,
          prospectId: id,
          contactId: input.contactId,
          channel: input.channel,
          status: input.status,
          reason: input.reason.trim(),
          evidence,
          effectiveAt,
          expiresAt,
          recordedBy: auth.membershipId,
        })
        .returning();
      await tx.insert(auditEvents).values({
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.membershipId,
        resourceType: 'prospect',
        resourceId: id,
        action: 'prospect.consent_recorded',
        metadata: { after },
      });
      return after!;
    });
  }
}
