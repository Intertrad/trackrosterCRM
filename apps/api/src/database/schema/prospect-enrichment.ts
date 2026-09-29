import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  foreignKey,
  unique,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { establishments } from './establishments.js';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
export const prospectTags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 80 }).notNull(),
    color: varchar('color', { length: 7 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('tags_tenant_id_unique').on(t.tenantId, t.id),
    uniqueIndex('tags_name_unique').on(t.tenantId, sql`lower(${t.name})`),
    check('tags_name_check', sql`length(btrim(${t.name}))>0`),
  ],
);
export const prospectTagLinks = pgTable(
  'prospect_tags',
  {
    tenantId: uuid('tenant_id').notNull(),
    prospectId: uuid('prospect_id').notNull(),
    tagId: uuid('tag_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.prospectId, t.tagId] }),
    foreignKey({
      columns: [t.tenantId, t.prospectId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.tagId],
      foreignColumns: [prospectTags.tenantId, prospectTags.id],
    }),
    index('prospect_tags_tag_idx').on(t.tenantId, t.tagId),
  ],
);
export const customFieldDefinitions = pgTable(
  'prospect_custom_field_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    fieldKey: varchar('field_key', { length: 64 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    dataType: varchar('data_type', { length: 16 }).notNull(),
    validation: jsonb('validation')
      .$type<{ required?: boolean; min?: number; max?: number; options?: string[] }>()
      .notNull()
      .default({}),
    visibility: jsonb('visibility').$type<{ roles?: string[] }>().notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('custom_fields_tenant_id_unique').on(t.tenantId, t.id),
    unique('custom_fields_key_unique').on(t.tenantId, t.fieldKey),
    check(
      'custom_fields_type_check',
      sql`${t.dataType} IN ('text','number','date','boolean','select','multi_select','json')`,
    ),
  ],
);
export const customFieldValues = pgTable(
  'prospect_custom_field_values',
  {
    tenantId: uuid('tenant_id').notNull(),
    prospectId: uuid('prospect_id').notNull(),
    definitionId: uuid('definition_id').notNull(),
    value: jsonb('value').$type<unknown>().notNull(),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.prospectId, t.definitionId] }),
    foreignKey({
      columns: [t.tenantId, t.prospectId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.definitionId],
      foreignColumns: [customFieldDefinitions.tenantId, customFieldDefinitions.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.updatedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('custom_field_values_definition_idx').on(t.tenantId, t.definitionId),
  ],
);
export const prospectDuplicates = pgTable(
  'prospect_duplicates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    leftProspectId: uuid('left_prospect_id').notNull(),
    rightProspectId: uuid('right_prospect_id').notNull(),
    matchingKeys: jsonb('matching_keys').$type<string[]>().notNull(),
    resolution: varchar('resolution', { length: 20 }).notNull().default('pending'),
    resolvedBy: uuid('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('duplicates_pair_unique').on(t.tenantId, t.leftProspectId, t.rightProspectId),
    foreignKey({
      columns: [t.tenantId, t.leftProspectId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.rightProspectId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.resolvedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    check('duplicates_order_check', sql`${t.leftProspectId}<${t.rightProspectId}`),
    check(
      'duplicates_resolution_check',
      sql`${t.resolution} IN ('pending','not_duplicate','merged')`,
    ),
    index('duplicates_status_idx').on(t.tenantId, t.resolution, t.id),
  ],
);
export const prospectMerges = pgTable(
  'prospect_merges',
  {
    tenantId: uuid('tenant_id').notNull(),
    sourceId: uuid('source_id').notNull(),
    targetId: uuid('target_id').notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }).defaultNow().notNull(),
    mergedBy: uuid('merged_by').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.sourceId] }),
    foreignKey({
      columns: [t.tenantId, t.sourceId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.targetId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.mergedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    check('prospect_merges_distinct', sql`${t.sourceId}<>${t.targetId}`),
    index('prospect_merges_target_idx').on(t.tenantId, t.targetId),
  ],
);
