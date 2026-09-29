import { foreignKey, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';

export interface PersonalPreferences {
  theme?: 'system' | 'light' | 'dark';
  density?: 'comfortable' | 'compact';
  reducedMotion?: boolean;
  highContrast?: boolean;
}

export const accountSettings = pgTable(
  'account_settings',
  {
    membershipId: uuid('membership_id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    phone: varchar('phone', { length: 40 }),
    avatar: jsonb('avatar').$type<{ url: string; altText: string }>(),
    locale: varchar('locale', { length: 35 }).default('en').notNull(),
    timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
    preferences: jsonb('preferences').$type<PersonalPreferences>().default({}).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'account_settings_tenant_membership_fk',
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('cascade'),
  ],
);
