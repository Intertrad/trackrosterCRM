import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { tenants } from './tenants.js';

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
]);

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    organizationId: uuid('organization_id').notNull(),

    name: varchar('name', {
      length: 255,
    }).notNull(),

    description: text('description'),

    status: campaignStatusEnum('status').default('draft').notNull(),

    startsAt: timestamp('starts_at', {
      withTimezone: true,
      mode: 'date',
    }),

    endsAt: timestamp('ends_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },

  (table) => [
    /*
     * Allows future tenant-safe composite
     * foreign keys to campaigns.
     */
    unique('campaigns_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * The organization must belong to the
     * same tenant as the campaign.
     */
    foreignKey({
      name: 'campaigns_tenant_organization_fk',

      columns: [table.tenantId, table.organizationId],

      foreignColumns: [organizations.tenantId, organizations.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    index('campaigns_tenant_id_idx').on(table.tenantId),

    index('campaigns_tenant_organization_idx').on(table.tenantId, table.organizationId),

    index('campaigns_tenant_status_idx').on(table.tenantId, table.status),

    /*
     * Campaign name cannot be blank after
     * trimming whitespace.
     */
    check(
      'campaigns_name_not_blank_check',
      sql`
        length(
          btrim(${table.name})
        ) > 0
      `,
    ),

    /*
     * If both dates exist, the campaign
     * cannot end before it starts.
     */
    check(
      'campaigns_date_range_check',
      sql`
        ${table.startsAt} IS NULL
        OR ${table.endsAt} IS NULL
        OR ${table.endsAt} >= ${table.startsAt}
      `,
    ),
  ],
);

export type Campaign = typeof campaigns.$inferSelect;

export type NewCampaign = typeof campaigns.$inferInsert;

export type CampaignStatus = (typeof campaignStatusEnum.enumValues)[number];
