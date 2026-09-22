import { foreignKey, index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { campaigns } from './campaigns.js';
import { establishments } from './establishments.js';
import { tenants } from './tenants.js';

export const campaignProspectStatusEnum = pgEnum('campaign_prospect_status', [
  'active',
  'excluded',
]);

/*
 * Durable commercial progress for a prospect inside
 * one campaign.
 *
 * This is intentionally separate from:
 *
 * - campaignProspectStatusEnum, which controls whether
 *   the campaign membership is included or excluded;
 * - establishment status, which describes the canonical
 *   establishment record;
 * - temporary collision/cooling-off decisions, which can
 *   expire and therefore must never be persisted here.
 */
export const campaignProspectLifecycleStageEnum = pgEnum('campaign_prospect_stage', [
  'to_contact',
  'contact_made',
  'in_progress',
  'follow_up',
  'qualified',
  'converted',
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

    lifecycleStage: campaignProspectLifecycleStageEnum('lifecycle_stage')
      .default('to_contact')
      .notNull(),

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

    index('campaign_prospects_tenant_campaign_lifecycle_stage_idx').on(
      table.tenantId,
      table.campaignId,
      table.lifecycleStage,
    ),
  ],
);

export type CampaignProspect = typeof campaignProspects.$inferSelect;

export type NewCampaignProspect = typeof campaignProspects.$inferInsert;

export type CampaignProspectStatus = (typeof campaignProspectStatusEnum.enumValues)[number];

export type CampaignProspectLifecycleStage =
  (typeof campaignProspectLifecycleStageEnum.enumValues)[number];
