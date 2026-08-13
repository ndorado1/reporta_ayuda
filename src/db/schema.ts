import { sql } from 'drizzle-orm'
import {
  pgTable, uuid, text, doublePrecision, integer, boolean,
  timestamp, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const urgencyEnum = pgEnum('urgency', ['alta', 'media', 'baja'])
export const requestStatusEnum = pgEnum('request_status', [
  'abierta', 'en_atencion', 'atendida', 'cancelada', 'archivada',
])
export const claimStatusEnum = pgEnum('claim_status', [
  'activo', 'cancelado', 'completado', 'vencido',
])
export const eventTypeEnum = pgEnum('event_type', [
  'request_created', 'request_claimed', 'request_fulfilled',
])

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  defaultZoom: integer('default_zoom').notNull().default(12),
  isActive: boolean('is_active').notNull().default(true),
  position: integer('position').notNull().default(0),
})

export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id').notNull().references(() => cities.id),
  publicCode: text('public_code').notNull().unique(),
  manageTokenHash: text('manage_token_hash').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  urgency: urgencyEnum('urgency').notNull().default('media'),
  status: requestStatusEnum('status').notNull().default('abierta'),
  requesterName: text('requester_name').notNull(),
  whatsapp: text('whatsapp'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  addressText: text('address_text'),
  neighborhood: text('neighborhood'),
  peopleCount: integer('people_count'),
  ipHash: text('ip_hash').notNull(),
  isHidden: boolean('is_hidden').notNull().default(false),
  needsReview: boolean('needs_review').notNull().default(false),
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
}, (t) => ({
  listing: index('requests_listing_idx').on(t.cityId, t.status, t.createdAt),
}))

export const requestItems = pgTable('request_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: text('quantity'),
  position: integer('position').notNull().default(0),
}, (t) => ({
  byRequest: index('request_items_request_idx').on(t.requestId),
}))

export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  volunteerName: text('volunteer_name').notNull(),
  volunteerWhatsapp: text('volunteer_whatsapp'),
  claimTokenHash: text('claim_token_hash').notNull(),
  status: claimStatusEnum('status').notNull().default('activo'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  // Una solicitud no puede tener dos voluntarios activos a la vez.
  oneActive: uniqueIndex('claims_one_active_idx')
    .on(t.requestId)
    .where(sql`status = 'activo'`),
}))

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: eventTypeEnum('type').notNull(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  cityId: uuid('city_id').notNull().references(() => cities.id),
  payload: jsonb('payload').$type<{ title: string; neighborhood: string | null; city: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  feed: index('events_feed_idx').on(t.cityId, t.createdAt),
}))

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
})

export type City = typeof cities.$inferSelect
export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
export type RequestItem = typeof requestItems.$inferSelect
export type Claim = typeof claims.$inferSelect
export type Event = typeof events.$inferSelect
