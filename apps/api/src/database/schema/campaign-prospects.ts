import { foreignKey, index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns.js';
import { establishments } from './establishments.js';
import { tenants } from './tenants.js';

export const campaignProspectStatusEnum = pgEnum('campaign_prospect_status', [
  'active',
  'excluded',
]);

export const campaignProspects = pgTable(
  'campaign_prospects',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    campaignId: uuid('campaign_id').notNull(),

    establishmentId: uuid('establishment_id').notNull(),

    status: campaignProspectStatusEnum('status').default('active').notNull(),

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
     * Useful for tenant-safe references.
     */
    unique('campaign_prospects_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Campaign + prospect identity.
     *
     * Used by assignment relationships.
     */
    unique('campaign_prospects_tenant_campaign_id_id_unique').on(
      table.tenantId,
      table.campaignId,
      table.id,
    ),

    /*
     * TR-017:
     *
     * Allows prospect activity rows to prove
     * that campaign + campaign prospect +
     * canonical establishment all represent
     * the same campaign membership.
     */
    unique('campaign_prospects_activity_reference_unique').on(
      table.tenantId,
      table.campaignId,
      table.id,
      table.establishmentId,
    ),

    /*
     * The campaign must belong to the
     * same tenant.
     */
    foreignKey({
      name: 'campaign_prospects_tenant_campaign_fk',

      columns: [table.tenantId, table.campaignId],

      foreignColumns: [campaigns.tenantId, campaigns.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * The establishment must also
     * belong to the same tenant.
     */
    foreignKey({
      name: 'campaign_prospects_tenant_establishment_fk',

      columns: [table.tenantId, table.establishmentId],

      foreignColumns: [establishments.tenantId, establishments.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * One canonical establishment can only
     * participate once in a given campaign.
     *
     * It may still participate in other campaigns.
     */
    unique('campaign_prospects_tenant_campaign_establishment_unique').on(
      table.tenantId,
      table.campaignId,
      table.establishmentId,
    ),

    index('campaign_prospects_tenant_campaign_idx').on(table.tenantId, table.campaignId),

    index('campaign_prospects_tenant_establishment_idx').on(table.tenantId, table.establishmentId),

    index('campaign_prospects_tenant_campaign_status_idx').on(
      table.tenantId,
      table.campaignId,
      table.status,
    ),
  ],
);

export type CampaignProspect = typeof campaignProspects.$inferSelect;

export type NewCampaignProspect = typeof campaignProspects.$inferInsert;

export type CampaignProspectStatus = (typeof campaignProspectStatusEnum.enumValues)[number];
