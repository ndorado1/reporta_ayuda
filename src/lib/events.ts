import { and, desc, eq, sql } from 'drizzle-orm'
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

/**
 * True si el id de referencia sigue existiendo. Puede no existir si viene de
 * un localStorage desincronizado o de un evento ya purgado, y en ese caso no
 * debe apagar el feed en silencio.
 */
async function referenceEventExists(eventId: string): Promise<boolean> {
  const [row] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1)
  return row !== undefined
}

/** Condiciones comunes a listEvents y countEventsSince. */
async function buildConditions(opts: { citySlug?: string; sinceId?: string }) {
  const conditions = []
  if (opts.citySlug) {
    conditions.push(
      sql`${events.cityId} = (select id from ${cities} where slug = ${opts.citySlug})`
    )
  }
  if (opts.sinceId) {
    // Si el id de referencia no existe, se ignora el filtro (se cuenta/lista
    // todo) en vez de dejar que "created_at > NULL" apague el feed sin aviso.
    if (await referenceEventExists(opts.sinceId)) {
      // Postgres calcula now() por transacción, no por sentencia: dos
      // eventos registrados en la misma transacción comparten created_at,
      // así que hace falta el id como desempate. La comparación se resuelve
      // enteramente en SQL (subconsulta), sin pasar el created_at de
      // referencia por JavaScript: un Date pierde la precisión de
      // microsegundos de Postgres y compararía el evento contra sí mismo
      // como "posterior".
      conditions.push(
        sql`(${events.createdAt}, ${events.id}) > (select created_at, id from ${events} where id = ${opts.sinceId})`
      )
    }
  }
  return conditions
}

export async function listEvents(opts: {
  citySlug?: string
  sinceId?: string
  limit?: number
}): Promise<Event[]> {
  const conditions = await buildConditions(opts)
  return db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(Math.min(opts.limit ?? 50, 50))
}

export async function countEventsSince(opts: {
  citySlug?: string
  sinceId?: string
}): Promise<number> {
  const conditions = await buildConditions(opts)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
  return row?.count ?? 0
}
