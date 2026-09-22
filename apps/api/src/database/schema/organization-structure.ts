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
import { organizations } from './organizations.js';
import { teams } from './teams.js';
import { tenantMemberships } from './tenant-memberships.js';
export const organizationRelationships = pgTable(
  'organization_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    parentOrganizationId: uuid('parent_organization_id').notNull(),
    childOrganizationId: uuid('child_organization_id').notNull(),
    relationshipType: varchar('relationship_type', { length: 24 })
      .$type<'parent' | 'brand' | 'partner' | 'coordination'>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.parentOrganizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'organization_relationships_parent_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.childOrganizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'organization_relationships_child_fk',
    }).onDelete('restrict'),
    check(
      'organization_relationships_type_check',
      sql`${t.relationshipType} IN ('parent','brand','partner','coordination')`,
    ),
    check(
      'organization_relationships_self_check',
      sql`${t.parentOrganizationId} <> ${t.childOrganizationId}`,
    ),
    check(
      'organization_relationships_order_check',
      sql`${t.relationshipType} NOT IN ('partner','coordination') OR ${t.parentOrganizationId} < ${t.childOrganizationId}`,
    ),
    uniqueIndex('organization_relationships_active_pair_unique')
      .on(t.tenantId, t.parentOrganizationId, t.childOrganizationId, t.relationshipType)
      .where(sql`${t.endedAt} IS NULL`),
    uniqueIndex('organization_relationships_active_parent_unique')
      .on(t.tenantId, t.childOrganizationId, t.relationshipType)
      .where(sql`${t.endedAt} IS NULL AND ${t.relationshipType} IN ('parent','brand')`),
    index('organization_relationships_parent_idx').on(t.tenantId, t.parentOrganizationId),
    index('organization_relationships_child_idx').on(t.tenantId, t.childOrganizationId),
  ],
);
export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    teamId: uuid('team_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    teamRole: varchar('team_role', { length: 16 })
      .$type<'manager' | 'member'>()
      .notNull()
      .default('member'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.teamId],
      foreignColumns: [teams.tenantId, teams.id],
      name: 'team_memberships_team_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'team_memberships_member_fk',
    }).onDelete('restrict'),
    check('team_memberships_role_check', sql`${t.teamRole} IN ('manager','member')`),
    check('team_memberships_dates_check', sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    index('team_memberships_team_idx').on(t.tenantId, t.teamId),
    index('team_memberships_member_idx').on(t.tenantId, t.membershipId),
  ],
);
