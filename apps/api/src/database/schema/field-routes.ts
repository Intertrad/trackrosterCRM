import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { teams } from './teams.js';
import { tenantMemberships } from './tenant-memberships.js';
import { campaignProspects } from './campaign-prospects.js';
import { actions } from './actions.js';
export type RoutePoint = { latitude: number; longitude: number };
export const fieldRoutes = pgTable(
  'field_routes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 16 })
      .$type<'draft' | 'active' | 'completed' | 'cancelled'>()
      .notNull()
      .default('draft'),
    startPoint: jsonb('start_point').$type<RoutePoint>().notNull(),
    endPoint: jsonb('end_point').$type<RoutePoint>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('field_routes_tenant_id').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.teamId],
      foreignColumns: [teams.tenantId, teams.id],
      name: 'field_routes_team_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.ownerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'field_routes_owner_fk',
    }).onDelete('restrict'),
    check('field_routes_status', sql`${t.status} IN ('draft','active','completed','cancelled')`),
    check('field_routes_name', sql`length(btrim(${t.name}))>0`),
    index('field_routes_owner_day').on(t.tenantId, t.ownerId, t.scheduledAt),
  ],
);
export const routeStops = pgTable(
  'route_stops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    routeId: uuid('route_id').notNull(),
    campaignProspectId: uuid('campaign_prospect_id').notNull(),
    actionId: uuid('action_id'),
    position: integer('position').notNull(),
    point: jsonb('point').$type<RoutePoint>().notNull(),
    status: varchar('status', { length: 16 })
      .$type<'pending' | 'arrived' | 'completed' | 'skipped'>()
      .notNull()
      .default('pending'),
    eta: timestamp('eta', { withTimezone: true }),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    outcome: varchar('outcome', { length: 2000 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.routeId],
      foreignColumns: [fieldRoutes.tenantId, fieldRoutes.id],
      name: 'route_stops_route_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.campaignProspectId],
      foreignColumns: [campaignProspects.tenantId, campaignProspects.id],
      name: 'route_stops_prospect_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.actionId],
      foreignColumns: [actions.tenantId, actions.id],
      name: 'route_stops_action_fk',
    }).onDelete('restrict'),
    unique('route_stops_prospect_once').on(t.tenantId, t.routeId, t.campaignProspectId),
    check('route_stops_position', sql`${t.position}>0`),
    check('route_stops_status', sql`${t.status} IN ('pending','arrived','completed','skipped')`),
    index('route_stops_order').on(t.tenantId, t.routeId, t.position),
  ],
);
