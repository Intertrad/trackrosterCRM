import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const userRoleEnum = pgEnum('user_role', [
  'client_admin',
  'director',
  'manager',
  'prospector',
  'observer',
]);

export const accessScopeEnum = pgEnum('access_scope', ['tenant', 'organization', 'team']);

export const userAccessGrants = pgTable(
  'user_access_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    userId: uuid('user_id').notNull(),

    role: userRoleEnum('role').notNull(),

    scopeType: accessScopeEnum('scope_type').notNull(),

    organizationId: uuid('organization_id'),

    teamId: uuid('team_id'),

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
     * A grant's tenant and user must belong together.
     *
     * This prevents:
     *
     * tenant A + user from tenant B
     */
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [users.tenantId, users.id],
      name: 'user_access_grants_tenant_user_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    /*
     * Organization scope must belong to the same tenant.
     */
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'user_access_grants_tenant_organization_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    /*
     * Team scope must belong to both the tenant
     * and organization supplied by the grant.
     */
    foreignKey({
      columns: [table.tenantId, table.organizationId, table.teamId],
      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
      name: 'user_access_grants_tenant_organization_team_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    /*
     * Controls which IDs are required for each scope.
     */
    check(
      'user_access_grants_scope_shape_check',
      sql`
        (
          ${table.scopeType} = 'tenant'
          AND ${table.organizationId} IS NULL
          AND ${table.teamId} IS NULL
        )
        OR
        (
          ${table.scopeType} = 'organization'
          AND ${table.organizationId} IS NOT NULL
          AND ${table.teamId} IS NULL
        )
        OR
        (
          ${table.scopeType} = 'team'
          AND ${table.organizationId} IS NOT NULL
          AND ${table.teamId} IS NOT NULL
        )
      `,
    ),

    /*
     * Controls which roles are allowed at which scopes.
     */
    check(
      'user_access_grants_role_scope_check',
      sql`
        (
          ${table.role} = 'client_admin'
          AND ${table.scopeType} = 'tenant'
        )
        OR
        (
          ${table.role} = 'director'
          AND ${table.scopeType} = 'organization'
        )
        OR
        (
          ${table.role} = 'manager'
          AND ${table.scopeType} = 'team'
        )
        OR
        (
          ${table.role} = 'prospector'
          AND ${table.scopeType} = 'team'
        )
        OR
        (
          ${table.role} = 'observer'
          AND ${table.scopeType} IN (
            'tenant',
            'organization',
            'team'
          )
        )
      `,
    ),

    index('user_access_grants_tenant_id_idx').on(table.tenantId),

    index('user_access_grants_tenant_user_idx').on(table.tenantId, table.userId),

    index('user_access_grants_tenant_organization_idx').on(table.tenantId, table.organizationId),

    index('user_access_grants_tenant_team_idx').on(table.tenantId, table.teamId),

    /*
     * Prevent duplicate grants.
     *
     * We use partial unique indexes because organization_id
     * and team_id are intentionally nullable depending on scope.
     */
    uniqueIndex('user_access_grants_tenant_scope_unique')
      .on(table.tenantId, table.userId, table.role)
      .where(sql`${table.scopeType} = 'tenant'`),

    uniqueIndex('user_access_grants_organization_scope_unique')
      .on(table.tenantId, table.userId, table.role, table.organizationId)
      .where(sql`${table.scopeType} = 'organization'`),

    uniqueIndex('user_access_grants_team_scope_unique')
      .on(table.tenantId, table.userId, table.role, table.organizationId, table.teamId)
      .where(sql`${table.scopeType} = 'team'`),
  ],
);

export type UserAccessGrant = typeof userAccessGrants.$inferSelect;

export type NewUserAccessGrant = typeof userAccessGrants.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type AccessScope = (typeof accessScopeEnum.enumValues)[number];
