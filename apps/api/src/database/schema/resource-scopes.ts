import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
import { campaigns } from './campaigns.js';
import { userRoleEnum } from './user-access-grants.js';

const multiPolygon = customType<{ data: string }>({
  dataType: () => 'geometry(MultiPolygon,4326)',
});
export const territories = pgTable(
  'territories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    boundary: multiPolygon('boundary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('territories_tenant_id_unique').on(t.tenantId, t.id),
    unique('territories_tenant_code_unique').on(t.tenantId, t.code),
    foreignKey({
      columns: [t.tenantId, t.parentId],
      foreignColumns: [t.tenantId, t.id],
      name: 'territories_tenant_parent_fk',
    }).onDelete('restrict'),
    check('territories_status_check', sql`${t.status} in ('active','inactive')`),
    check('territories_name_check', sql`length(btrim(${t.name})) > 0`),
    check('territories_parent_check', sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
    check(
      'territories_boundary_check',
      sql`${t.boundary} IS NULL OR (ST_IsValid(${t.boundary}) AND NOT ST_IsEmpty(${t.boundary}) AND ST_CoveredBy(${t.boundary}, ST_MakeEnvelope(-180,-90,180,90,4326)))`,
    ),
    index('territories_parent_idx').on(t.tenantId, t.parentId),
  ],
);
export const campaignTerritories = pgTable(
  'campaign_territories',
  {
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    territoryId: uuid('territory_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.campaignId, t.territoryId] }),
    foreignKey({
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
      name: 'campaign_territories_campaign_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.territoryId],
      foreignColumns: [territories.tenantId, territories.id],
      name: 'campaign_territories_territory_fk',
    }).onDelete('restrict'),
    index('campaign_territories_territory_idx').on(t.tenantId, t.territoryId),
  ],
);
export const membershipResourceScopes = pgTable(
  'membership_resource_scopes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: userRoleEnum('role').notNull(),
    scopeType: varchar('scope_type', { length: 16 }).$type<'territory' | 'campaign'>().notNull(),
    territoryId: uuid('territory_id'),
    campaignId: uuid('campaign_id'),
    accessLevel: varchar('access_level', { length: 16 })
      .$type<'read' | 'read_write' | 'manage'>()
      .notNull()
      .default('read'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'resource_scopes_membership_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.territoryId],
      foreignColumns: [territories.tenantId, territories.id],
      name: 'resource_scopes_territory_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
      name: 'resource_scopes_campaign_fk',
    }).onDelete('cascade'),
    check(
      'resource_scopes_shape_check',
      sql`(${t.scopeType} = 'territory' AND ${t.territoryId} IS NOT NULL AND ${t.campaignId} IS NULL) OR (${t.scopeType} = 'campaign' AND ${t.campaignId} IS NOT NULL AND ${t.territoryId} IS NULL)`,
    ),
    check('resource_scopes_level_check', sql`${t.accessLevel} IN ('read','read_write','manage')`),
    check(
      'resource_scopes_role_check',
      sql`(${t.role} IN ('director','manager')) OR (${t.role} IN ('prospector','observer') AND ${t.accessLevel} = 'read')`,
    ),
    uniqueIndex('resource_scopes_campaign_unique')
      .on(t.tenantId, t.userId, t.role, t.campaignId)
      .where(sql`${t.campaignId} IS NOT NULL`),
    uniqueIndex('resource_scopes_territory_unique')
      .on(t.tenantId, t.userId, t.role, t.territoryId)
      .where(sql`${t.territoryId} IS NOT NULL`),
    index('resource_scopes_member_idx').on(t.tenantId, t.userId),
  ],
);
