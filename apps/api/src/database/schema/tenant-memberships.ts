import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { identities } from './identities.js';
import { organizations } from './organizations.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';

export const tenantMembershipStatusEnum = pgEnum('tenant_membership_status', [
  'invited',
  'active',
  'suspended',
  'departed',
]);

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id').notNull(),

    identityId: uuid('identity_id').notNull(),

    displayName: varchar('display_name', {
      length: 120,
    }),

    status: tenantMembershipStatusEnum('status').default('invited').notNull(),

    defaultOrganizationId: uuid('default_organization_id'),

    defaultTeamId: uuid('default_team_id'),

    invitedAt: timestamp('invited_at', {
      withTimezone: true,
      mode: 'date',
    }),

    activatedAt: timestamp('activated_at', {
      withTimezone: true,
      mode: 'date',
    }),

    suspendedAt: timestamp('suspended_at', {
      withTimezone: true,
      mode: 'date',
    }),

    departedAt: timestamp('departed_at', {
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
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: 'tenant_memberships_tenant_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.identityId],
      foreignColumns: [identities.id],
      name: 'tenant_memberships_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.tenantId, table.defaultOrganizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'tenant_memberships_default_organization_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.tenantId, table.defaultOrganizationId, table.defaultTeamId],
      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
      name: 'tenant_memberships_default_team_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    unique('tenant_memberships_tenant_identity_unique').on(table.tenantId, table.identityId),

    unique('tenant_memberships_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Authentication sessions bind all three values together.  The primary
     * key makes the identity functionally dependent on the membership, but
     * this explicit key gives PostgreSQL a parent key for the composite
     * session foreign key and prevents identity/tenant claim mixing.
     */
    unique('tenant_memberships_tenant_id_identity_unique').on(
      table.tenantId,
      table.id,
      table.identityId,
    ),

    check(
      'tenant_memberships_display_name_check',
      sql`
        ${table.displayName} IS NULL
        OR (
          ${table.displayName} = btrim(${table.displayName})
          AND char_length(${table.displayName}) > 0
        )
      `,
    ),

    check(
      'tenant_memberships_status_timestamps_check',
      sql`
        (
          ${table.status} = 'invited'
          AND ${table.invitedAt} IS NOT NULL
          AND ${table.activatedAt} IS NULL
          AND ${table.suspendedAt} IS NULL
          AND ${table.departedAt} IS NULL
        )
        OR
        (
          ${table.status} = 'active'
          AND ${table.activatedAt} IS NOT NULL
          AND ${table.suspendedAt} IS NULL
          AND ${table.departedAt} IS NULL
        )
        OR
        (
          ${table.status} = 'suspended'
          AND ${table.activatedAt} IS NOT NULL
          AND ${table.suspendedAt} IS NOT NULL
          AND ${table.departedAt} IS NULL
        )
        OR
        (
          ${table.status} = 'departed'
          AND ${table.departedAt} IS NOT NULL
        )
      `,
    ),

    check(
      'tenant_memberships_timestamp_order_check',
      sql`
        ${table.updatedAt} >= ${table.createdAt}
        AND (
          ${table.invitedAt} IS NULL
          OR ${table.invitedAt} >= ${table.createdAt}
        )
        AND (
          ${table.activatedAt} IS NULL
          OR ${table.activatedAt} >= COALESCE(${table.invitedAt}, ${table.createdAt})
        )
        AND (
          ${table.suspendedAt} IS NULL
          OR ${table.suspendedAt} >= ${table.activatedAt}
        )
        AND (
          ${table.departedAt} IS NULL
          OR ${table.departedAt} >= COALESCE(
            ${table.suspendedAt},
            ${table.activatedAt},
            ${table.invitedAt},
            ${table.createdAt}
          )
        )
      `,
    ),

    check(
      'tenant_memberships_default_scope_shape_check',
      sql`${table.defaultTeamId} IS NULL OR ${table.defaultOrganizationId} IS NOT NULL`,
    ),

    index('tenant_memberships_identity_status_idx').on(table.identityId, table.status),

    index('tenant_memberships_tenant_status_idx').on(table.tenantId, table.status),

    index('tenant_memberships_tenant_default_organization_idx').on(
      table.tenantId,
      table.defaultOrganizationId,
    ),

    index('tenant_memberships_tenant_default_team_idx').on(
      table.tenantId,
      table.defaultOrganizationId,
      table.defaultTeamId,
    ),
  ],
);

export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
export type TenantMembershipStatus = (typeof tenantMembershipStatusEnum.enumValues)[number];
