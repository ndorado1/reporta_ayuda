import { and, desc, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cities, events, type Event } from '@/db/schema'

export type EventType = 'request_created' | 'request_claimed' | 'request_fulfilled'
export type EventPayload = { title: string; neighborhood: string | null; city: string }

export async function recordEvent(input: {
  type: EventType
  requestId: string
  cityId: string
  payload: EventPayload
}): Promise<Event> {
  const [row] = await db.insert(events).values(input).returning()
  return row
}

/** Subconsulta: instante de creación del último evento visto por el navegador. */
function createdAtOf(eventId: string) {
  return sql`(select created_at from ${events} where id = ${eventId})`
}

export async function listEvents(opts: {
  citySlug?: string
  sinceId?: string
  limit?: number
}): Promise<Event[]> {
  const conditions = []
  if (opts.citySlug) {
    conditions.push(
      sql`${events.cityId} = (select id from ${cities} where slug = ${opts.citySlug})`
    )
  }
  if (opts.sinceId) conditions.push(gt(events.createdAt, createdAtOf(opts.sinceId) as never))

  return db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.createdAt))
    .limit(Math.min(opts.limit ?? 50, 50))
}

export async function countEventsSince(opts: {
  citySlug?: string
  sinceId?: string
}): Promise<number> {
  const rows = await listEvents({ ...opts, limit: 50 })
  return rows.length
}
