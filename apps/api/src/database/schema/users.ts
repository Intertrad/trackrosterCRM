import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'disabled']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    email: varchar('email', {
      length: 320,
    })
      .notNull()
      .unique(),

    passwordHash: varchar('password_hash', {
      length: 255,
    }).notNull(),

    status: userStatusEnum('status').default('active').notNull(),

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
    index('users_tenant_id_idx').on(table.tenantId),

    check('users_email_lowercase_check', sql`${table.email} = lower(${table.email})`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
