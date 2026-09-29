import type { StoredSsoSettings } from '../../security-administration/sso-settings.js';
import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
export const tenantSecurityPolicies = pgTable(
  'tenant_security_policies',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sso: jsonb('sso').$type<StoredSsoSettings>(),
    requireMfa: boolean('require_mfa').default(false).notNull(),
    passwordMinLength: integer('password_min_length').default(12).notNull(),
    sessionMaxHours: integer('session_max_hours').default(168).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('tenant_security_password_length_check', sql`${t.passwordMinLength} BETWEEN 12 AND 128`),
    check('tenant_security_session_hours_check', sql`${t.sessionMaxHours} BETWEEN 1 AND 168`),
  ],
);
