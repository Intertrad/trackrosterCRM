import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
export interface OutcomeDefinition {
  code: string;
  label: string;
  behavior: string;
  enabled: boolean;
  actionTypes: string[];
}
export const outcomeSettings = pgTable('outcome_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  outcomes: jsonb('outcomes').$type<OutcomeDefinition[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
