import { boolean, foreignKey, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('connected'),
    config: jsonb('config').default({}).notNull(),
    connectedBy: uuid('connected_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.connectedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const apiClients = pgTable(
  'api_clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    secretHash: varchar('secret_hash', { length: 128 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    events: jsonb('events').$type<string[]>().notNull(),
    secretHash: varchar('secret_hash', { length: 128 }).notNull(),
    active: boolean('active').default(true).notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    webhookId: uuid('webhook_id').notNull(),
    event: varchar('event', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    attempts: varchar('attempts', { length: 10 }).notNull().default('0'),
    responseCode: varchar('response_code', { length: 10 }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.webhookId], foreignColumns: [webhooks.id] }),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
  ],
);
