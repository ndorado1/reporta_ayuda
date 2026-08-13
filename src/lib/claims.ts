import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cities, claims, events, requests } from '@/db/schema'
import { generateToken, hashIp, hashToken, verifyToken } from './tokens'
import { consumeRate } from './ratelimit'

export const CLAIM_HOURS = 6

export async function claimRequest(
  input: { publicCode: string; volunteerName: string; volunteerWhatsapp?: string },
  ip: string
): Promise<{ claimToken: string }> {
  const name = input.volunteerName.trim()
  if (name.length < 2) throw new Error('Escribe tu nombre para que sepan quién va')

  await consumeRate(ip, 'create_claim')

  const [found] = await db
    .select({ request: requests, cityName: cities.name })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, input.publicCode))
    .limit(1)
  if (!found) throw new Error('Esta solicitud no existe')
  const request = found.request
  if (request.status === 'en_atencion') throw new Error('Esta solicitud ya está siendo atendida')
  if (request.status !== 'abierta') throw new Error('Esta solicitud ya no está abierta')

  const claimToken = generateToken()
  const expiresAt = new Date(Date.now() + CLAIM_HOURS * 3600_000)

  await db.transaction(async (tx) => {
    await tx.insert(claims).values({
      requestId: request.id,
      volunteerName: name,
      volunteerWhatsapp: input.volunteerWhatsapp || null,
      claimTokenHash: hashToken(claimToken),
      ipHash: hashIp(ip),
      expiresAt,
    })

    await tx.update(requests)
      .set({ status: 'en_atencion', updatedAt: new Date() })
      .where(eq(requests.id, request.id))

    await tx.insert(events).values({
      type: 'request_claimed',
      requestId: request.id,
      cityId: request.cityId,
      payload: { title: request.title, neighborhood: request.neighborhood, city: found.cityName },
    })
  })

  return { claimToken }
}

export async function cancelClaim(publicCode: string, claimToken: string): Promise<void> {
  const [row] = await db
    .select({ claim: claims, requestId: requests.id })
    .from(claims)
    .innerJoin(requests, eq(claims.requestId, requests.id))
    .where(and(eq(requests.publicCode, publicCode), eq(claims.status, 'activo')))
    .limit(1)

  if (!row) throw new Error('No hay nadie en camino para esta solicitud')
  if (!verifyToken(claimToken, row.claim.claimTokenHash)) throw new Error('No autorizado')

  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'cancelado' }).where(eq(claims.id, row.claim.id))
    await tx.update(requests)
      .set({ status: 'abierta', updatedAt: new Date() })
      .where(and(eq(requests.id, row.requestId), eq(requests.status, 'en_atencion')))
  })
}

/**
 * Vence los claims cumplidos y reabre sus solicitudes. Se llama antes de cada
 * listado, así la reapertura no depende de un cron. Idempotente por diseño.
 */
export async function expireStaleClaims(): Promise<number> {
  const expired = await db
    .update(claims)
    .set({ status: 'vencido' })
    .where(and(eq(claims.status, 'activo'), lt(claims.expiresAt, new Date())))
    .returning({ requestId: claims.requestId })

  if (expired.length === 0) return 0

  const ids = expired.map((e) => e.requestId)
  // Solo reabre lo que sigue en atención: si ya la marcaron atendida, no se toca.
  await db
    .update(requests)
    .set({ status: 'abierta', updatedAt: new Date() })
    .where(and(
      eq(requests.status, 'en_atencion'),
      sql`${requests.id} in ${ids}`
    ))

  return expired.length
}
