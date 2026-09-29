import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns.js';
import { organizations } from './organizations.js';
export const campaignOrganizations = pgTable(
  'campaign_organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    accessMode: varchar('access_mode', { length: 16 })
      .$type<'participate' | 'read_only'>()
      .notNull()
      .default('participate'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
      name: 'campaign_organizations_campaign_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'campaign_organizations_organization_fk',
    }).onDelete('restrict'),
    check('campaign_organizations_mode_check', sql`${t.accessMode} IN ('participate','read_only')`),
    uniqueIndex('campaign_organizations_active_unique')
      .on(t.tenantId, t.campaignId, t.organizationId)
      .where(sql`${t.endedAt} IS NULL`),
    index('campaign_organizations_organization_idx').on(t.tenantId, t.organizationId),
  ],
);
