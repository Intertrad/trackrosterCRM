import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  bigint,
} from 'drizzle-orm/pg-core';
import { establishments } from './establishments.js';
import { establishmentContacts } from './establishment-contacts.js';
import { tenantMemberships } from './tenant-memberships.js';
export const contactConsents = pgTable(
  'contact_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequence: bigint('sequence', { mode: 'number' }).generatedAlwaysAsIdentity().notNull(),
    tenantId: uuid('tenant_id').notNull(),
    prospectId: uuid('prospect_id').notNull(),
    contactId: uuid('contact_id'),
    channel: varchar('channel', { length: 16 })
      .$type<'all' | 'phone' | 'email' | 'sms' | 'visit'>()
      .notNull(),
    status: varchar('status', { length: 16 }).$type<'allowed' | 'blocked' | 'unknown'>().notNull(),
    reason: varchar('reason', { length: 2000 }).notNull(),
    evidence: jsonb('evidence').$type<Record<string, string>>().notNull().default({}),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid('recorded_by').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.prospectId],
      foreignColumns: [establishments.tenantId, establishments.id],
      name: 'contact_consents_prospect_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.contactId],
      foreignColumns: [establishmentContacts.tenantId, establishmentContacts.id],
      name: 'contact_consents_contact_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.recordedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'contact_consents_recorder_fk',
    }).onDelete('restrict'),
    check(
      'contact_consents_channel_check',
      sql`${t.channel} IN ('all','phone','email','sms','visit')`,
    ),
    check('contact_consents_status_check', sql`${t.status} IN ('allowed','blocked','unknown')`),
    check('contact_consents_reason_check', sql`length(btrim(${t.reason})) > 0`),
    check(
      'contact_consents_dates_check',
      sql`${t.expiresAt} IS NULL OR ${t.expiresAt} > ${t.effectiveAt}`,
    ),
    index('contact_consents_resolution_idx').on(
      t.tenantId,
      t.prospectId,
      t.contactId,
      t.channel,
      t.effectiveAt,
      t.sequence,
    ),
  ],
);
