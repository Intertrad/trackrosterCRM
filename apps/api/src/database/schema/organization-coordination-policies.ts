import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { tenants } from './tenants.js';

export const organizationCoordinationPolicyTypeEnum = pgEnum(
  'organization_coordination_policy_type',
  ['shared', 'coordinated', 'delayed', 'independent'],
);

export const organizationCoordinationPolicies = pgTable(
  'organization_coordination_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Relationships are symmetric.
     *
     * The application must canonicalize the pair
     * so organizationAId < organizationBId.
     */
    organizationAId: uuid('organization_a_id').notNull(),

    organizationBId: uuid('organization_b_id').notNull(),

    policy: organizationCoordinationPolicyTypeEnum('policy').default('shared').notNull(),

    /*
     * Used only by DELAYED.
     *
     * Minutes gives us flexibility for:
     * 24 hours, 3 days, 7 days, etc.
     */
    delayMinutes: integer('delay_minutes'),

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
     * Only one relationship may exist for an
     * organization pair inside a tenant.
     */
    unique('organization_coordination_policies_pair_unique').on(
      table.tenantId,
      table.organizationAId,
      table.organizationBId,
    ),

    /*
     * Both organizations must belong to
     * the same tenant as the policy.
     */
    foreignKey({
      name: 'organization_coordination_policies_organization_a_fk',

      columns: [table.tenantId, table.organizationAId],

      foreignColumns: [organizations.tenantId, organizations.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      name: 'organization_coordination_policies_organization_b_fk',

      columns: [table.tenantId, table.organizationBId],

      foreignColumns: [organizations.tenantId, organizations.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Same-organization coordination does not
     * need a policy row.
     *
     * Same-org behavior always uses the normal
     * TR-016 collision rules.
     */
    check(
      'organization_coordination_policies_distinct_organizations_check',
      sql`
        ${table.organizationAId}
        <> ${table.organizationBId}
      `,
    ),

    /*
     * Store every symmetric pair in exactly
     * one canonical order.
     *
     * This prevents:
     *
     * A / B = shared
     * B / A = independent
     *
     * from existing simultaneously.
     */
    check(
      'organization_coordination_policies_canonical_pair_check',
      sql`
        ${table.organizationAId}
        < ${table.organizationBId}
      `,
    ),

    /*
     * DELAYED requires a positive delay.
     *
     * All other policy types must not contain
     * a delay value.
     */
    check(
      'organization_coordination_policies_delay_check',
      sql`
        (
          ${table.policy} = 'delayed'
          AND ${table.delayMinutes} IS NOT NULL
          AND ${table.delayMinutes} > 0
        )
        OR
        (
          ${table.policy} <> 'delayed'
          AND ${table.delayMinutes} IS NULL
        )
      `,
    ),

    index('organization_coordination_policies_tenant_a_idx').on(
      table.tenantId,
      table.organizationAId,
    ),

    index('organization_coordination_policies_tenant_b_idx').on(
      table.tenantId,
      table.organizationBId,
    ),

    index('organization_coordination_policies_tenant_policy_idx').on(table.tenantId, table.policy),
  ],
);

export type OrganizationCoordinationPolicy = typeof organizationCoordinationPolicies.$inferSelect;

export type NewOrganizationCoordinationPolicy =
  typeof organizationCoordinationPolicies.$inferInsert;

export type OrganizationCoordinationPolicyType =
  (typeof organizationCoordinationPolicyTypeEnum.enumValues)[number];
