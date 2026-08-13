import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { rateLimits } from '@/db/schema'
import { hashIp } from './tokens'

export type RateAction = 'create_request' | 'create_claim' | 'contact'

/**
 * Umbrales por hora. Son altos a propósito: los operadores móviles
 * colombianos usan CGNAT y muchas personas comparten una IP pública.
 */
export const RATE_LIMITS: Record<RateAction, number> = {
  create_request: 20,
  create_claim: 20,
  contact: 40,
}

export async function consumeRate(
  ip: string,
  action: RateAction
): Promise<{ exceeded: boolean; count: number }> {
  const hour = new Date()
  hour.setMinutes(0, 0, 0)
  const key = `${hashIp(ip)}:${action}:${hour.toISOString()}`

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: hour })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning()

  // Limpieza oportunista: sin esto la tabla crece sin límite.
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < now() - interval '2 hours'`)

  return { exceeded: row.count > RATE_LIMITS[action], count: row.count }
}
