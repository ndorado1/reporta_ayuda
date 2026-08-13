import { z } from 'zod'
import { db } from '@/db'
import { cities, claims, events, reports, requestItems, requests } from '@/db/schema'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { generatePublicCode, generateToken, hashIp, hashToken, verifyToken } from './tokens'
import { normalizePhone } from './whatsapp'
import { isNearCity, type Coords } from './geo'
import { consumeRate } from './ratelimit'
import { expireStaleClaims } from './claims'

export const createRequestSchema = z.object({
  citySlug: z.string().min(1, 'Elige una ciudad'),
  title: z.string().trim().min(8, 'Escribe un título más descriptivo').max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  urgency: z.enum(['alta', 'media', 'baja']),
  items: z
    .array(z.object({
      name: z.string().trim().min(2, 'Escribe qué necesitas').max(80),
      quantity: z.string().trim().max(40).optional().or(z.literal('')),
    }))
    .min(1, 'Agrega al menos una cosa que necesites')
    .max(20),
  requesterName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  whatsapp: z.string().min(1, 'Escribe tu número de WhatsApp'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressText: z.string().trim().max(200).optional().or(z.literal('')),
  neighborhood: z.string().trim().max(80).optional().or(z.literal('')),
  peopleCount: z.number().int().min(1).max(999).optional(),
  acceptsPrivacy: z
    .boolean()
    .refine((v) => v === true, { message: 'Debes autorizar el tratamiento de tus datos' }),
  // Campo trampa: las personas lo dejan vacío, los bots lo llenan.
  website: z.string().max(0, 'Envío rechazado').optional().or(z.literal('')),
})

export type CreateRequestInput = z.input<typeof createRequestSchema>

export async function createRequest(
  raw: CreateRequestInput,
  ip: string
): Promise<{ publicCode: string; manageToken: string; needsReview: boolean }> {
  const input = createRequestSchema.parse(raw)

  const [city] = await db.select().from(cities)
    .where(eq(cities.slug, input.citySlug)).limit(1)
  if (!city || !city.isActive) throw new Error('La ciudad seleccionada no está disponible')

  const phone = normalizePhone(input.whatsapp)
  if (!phone) throw new Error('El número debe ser un celular colombiano de diez dígitos')

  if (!isNearCity({ lat: input.lat, lng: input.lng }, { lat: city.centerLat, lng: city.centerLng })) {
    throw new Error(`La ubicación marcada queda muy lejos de ${city.name}. Revisa el punto en el mapa.`)
  }

  // No bloquea: publica y marca para revisión. Ver spec, sección de abuso.
  const rate = await consumeRate(ip, 'create_request')

  const manageToken = generateToken()
  const publicCode = generatePublicCode()

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(requests).values({
      cityId: city.id,
      publicCode,
      manageTokenHash: hashToken(manageToken),
      title: input.title,
      description: input.description || null,
      urgency: input.urgency,
      requesterName: input.requesterName,
      whatsapp: phone,
      lat: input.lat,
      lng: input.lng,
      addressText: input.addressText || null,
      neighborhood: input.neighborhood || null,
      peopleCount: input.peopleCount ?? null,
      ipHash: hashIp(ip),
      needsReview: rate.exceeded,
    }).returning()

    await tx.insert(requestItems).values(
      input.items.map((item, index) => ({
        requestId: row.id,
        name: item.name,
        quantity: item.quantity || null,
        position: index,
      }))
    )

    await tx.insert(events).values({
      type: 'request_created',
      requestId: row.id,
      cityId: city.id,
      payload: { title: row.title, neighborhood: row.neighborhood, city: city.name },
    })

    return { publicCode, manageToken, needsReview: rate.exceeded }
  })
}

export type RequestStatus = 'abierta' | 'en_atencion' | 'atendida' | 'cancelada' | 'archivada'
export type Urgency = 'alta' | 'media' | 'baja'

const VISIBLE_BY_DEFAULT: RequestStatus[] = ['abierta', 'en_atencion']

export type RequestListItem = {
  publicCode: string
  title: string
  urgency: Urgency
  status: RequestStatus
  neighborhood: string | null
  cityName: string
  citySlug: string
  lat: number
  lng: number
  itemsPreview: string[]
  itemCount: number
  claimedBy: string | null
  createdAt: Date
  distanceKm?: number
}

export type ListFilters = {
  citySlug?: string
  statuses?: RequestStatus[]
  urgency?: Urgency
  search?: string
  near?: Coords
  limit?: number
}

export async function listRequests(filters: ListFilters): Promise<RequestListItem[]> {
  // Reabre lo abandonado antes de responder: la spec no usa cron para esto.
  await expireStaleClaims()

  const statuses = filters.statuses?.length ? filters.statuses : VISIBLE_BY_DEFAULT
  const conditions = [eq(requests.isHidden, false), inArray(requests.status, statuses)]

  if (filters.citySlug) conditions.push(eq(cities.slug, filters.citySlug))
  if (filters.urgency) conditions.push(eq(requests.urgency, filters.urgency))
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      or(ilike(requests.title, term), ilike(requests.neighborhood, term)) as never
    )
  }

  // Haversine calculada en SQL (no en memoria): el LIMIT debe recortar las
  // solicitudes más cercanas, no las más recientes. Sigue sin PostGIS a
  // propósito; tras filtrar por ciudad y estado el conjunto es pequeño y un
  // recorrido secuencial es aceptable — lo que no es aceptable es truncar
  // antes de ordenar por distancia.
  const near = filters.near
  const distanceExpr = near
    ? sql<number>`(
        2 * 6371 * asin(sqrt(
          power(sin(radians(${requests.lat} - ${near.lat}) / 2), 2) +
          cos(radians(${near.lat})) * cos(radians(${requests.lat})) *
          power(sin(radians(${requests.lng} - ${near.lng}) / 2), 2)
        ))
      )`
    : sql<number | null>`null`

  const rows = await db
    .select({
      publicCode: requests.publicCode,
      title: requests.title,
      urgency: requests.urgency,
      status: requests.status,
      neighborhood: requests.neighborhood,
      lat: requests.lat,
      lng: requests.lng,
      createdAt: requests.createdAt,
      cityName: cities.name,
      citySlug: cities.slug,
      itemsPreview: sql<string[]>`(
        select coalesce(array_agg(name order by position), '{}')
        from (
          select name, position from ${requestItems}
          where request_id = ${requests.id} order by position limit 3
        ) t
      )`,
      itemCount: sql<number>`(
        select count(*)::int from ${requestItems} where request_id = ${requests.id}
      )`,
      claimedBy: sql<string | null>`(
        select volunteer_name from ${claims}
        where request_id = ${requests.id} and status = 'activo' limit 1
      )`,
      distanceKm: distanceExpr,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(near ? sql`${distanceExpr} asc` : desc(requests.createdAt))
    .limit(Math.min(filters.limit ?? 200, 200))

  return rows.map((row) => ({
    ...row,
    distanceKm: row.distanceKm ?? undefined,
  })) as unknown as RequestListItem[]
}

export type RequestDetail = Omit<RequestListItem, 'itemsPreview' | 'distanceKm'> & {
  description: string | null
  addressText: string | null
  requesterName: string
  peopleCount: number | null
  items: { name: string; quantity: string | null }[]
  canManage: boolean
  fulfilledAt: Date | null
}

export async function getRequestByCode(
  code: string,
  manageToken?: string
): Promise<RequestDetail | null> {
  await expireStaleClaims()

  // Proyección explícita sin whatsapp ni manageTokenHash: esta consulta
  // alimenta una vista pública y no debe poder filtrar ninguna de las dos
  // por un futuro `...row.request` escrito de prisa.
  const [row] = await db
    .select({
      id: requests.id,
      publicCode: requests.publicCode,
      title: requests.title,
      description: requests.description,
      urgency: requests.urgency,
      status: requests.status,
      neighborhood: requests.neighborhood,
      addressText: requests.addressText,
      requesterName: requests.requesterName,
      peopleCount: requests.peopleCount,
      lat: requests.lat,
      lng: requests.lng,
      createdAt: requests.createdAt,
      fulfilledAt: requests.fulfilledAt,
      cityName: cities.name,
      citySlug: cities.slug,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(eq(requests.publicCode, code), eq(requests.isHidden, false)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select({ name: requestItems.name, quantity: requestItems.quantity })
    .from(requestItems)
    .where(eq(requestItems.requestId, row.id))
    .orderBy(requestItems.position)

  const [claim] = await db
    .select({ volunteerName: claims.volunteerName })
    .from(claims)
    .where(and(eq(claims.requestId, row.id), eq(claims.status, 'activo')))
    .limit(1)

  // El hash solo se trae si hay token que verificar, y en una consulta
  // aparte que jamás toca whatsapp.
  let canManage = false
  if (manageToken) {
    const [tokenRow] = await db
      .select({ manageTokenHash: requests.manageTokenHash })
      .from(requests)
      .where(eq(requests.id, row.id))
      .limit(1)
    canManage = tokenRow ? verifyToken(manageToken, tokenRow.manageTokenHash) : false
  }

  return {
    publicCode: row.publicCode,
    title: row.title,
    description: row.description,
    urgency: row.urgency,
    status: row.status,
    neighborhood: row.neighborhood,
    addressText: row.addressText,
    requesterName: row.requesterName,
    peopleCount: row.peopleCount,
    lat: row.lat,
    lng: row.lng,
    cityName: row.cityName,
    citySlug: row.citySlug,
    items,
    itemCount: items.length,
    claimedBy: claim?.volunteerName ?? null,
    createdAt: row.createdAt,
    fulfilledAt: row.fulfilledAt,
    canManage,
  }
}

async function requireOwner(code: string, manageToken: string) {
  // Proyección explícita: manageTokenHash se necesita para verificar, pero
  // whatsapp no tiene por qué pasar por aquí.
  const [row] = await db
    .select({
      id: requests.id,
      cityId: requests.cityId,
      title: requests.title,
      neighborhood: requests.neighborhood,
      manageTokenHash: requests.manageTokenHash,
      cityName: cities.name,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, code))
    .limit(1)

  if (!row) throw new Error('Esta solicitud no existe')
  if (!verifyToken(manageToken, row.manageTokenHash)) throw new Error('No autorizado')
  return row
}

export async function fulfillRequest(code: string, manageToken: string): Promise<void> {
  const owner = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    await tx.update(requests)
      .set({ status: 'atendida', fulfilledAt: new Date(), updatedAt: new Date() })
      .where(eq(requests.id, owner.id))

    await tx.update(claims)
      .set({ status: 'completado' })
      .where(and(eq(claims.requestId, owner.id), eq(claims.status, 'activo')))

    await tx.insert(events).values({
      type: 'request_fulfilled',
      requestId: owner.id,
      cityId: owner.cityId,
      payload: { title: owner.title, neighborhood: owner.neighborhood, city: owner.cityName },
    })
  })
}

export async function cancelRequest(code: string, manageToken: string): Promise<void> {
  const owner = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    // Cancelar es la vía de borrado que promete el aviso de privacidad:
    // "desaparece de inmediato", sin esperar los 60 días del mantenimiento
    // (ver anonymizeOldRequests en maintenance.ts, que hace exactamente esto
    // por plazo). Solo aplica aquí, no al marcar como atendida: quien recibió
    // ayuda no está pidiendo que se borren sus datos.
    await tx.update(requests)
      .set({
        status: 'cancelada',
        updatedAt: new Date(),
        requesterName: 'Anónimo',
        whatsapp: null,
        addressText: null,
        // Redondea a ~1 km para que no se pueda ubicar la vivienda.
        lat: sql`round(${requests.lat}::numeric, 2)::double precision`,
        lng: sql`round(${requests.lng}::numeric, 2)::double precision`,
        anonymizedAt: new Date(),
      })
      .where(eq(requests.id, owner.id))
    await tx.update(claims)
      .set({ status: 'cancelado' })
      .where(and(eq(claims.requestId, owner.id), eq(claims.status, 'activo')))
  })
}

/**
 * Único lugar del sistema que devuelve el número. Todo lo demás lo omite,
 * para que el listado público no sirva de directorio de víctimas.
 */
export async function getContactPhone(
  code: string
): Promise<{ phone: string; title: string } | null> {
  const [row] = await db
    .select({ phone: requests.whatsapp, title: requests.title })
    .from(requests)
    .where(and(eq(requests.publicCode, code), eq(requests.isHidden, false)))
    .limit(1)

  if (!row?.phone) return null
  return { phone: row.phone, title: row.title }
}

export async function reportRequest(code: string, reason: string, ip: string): Promise<void> {
  const [row] = await db.select({ id: requests.id }).from(requests)
    .where(eq(requests.publicCode, code)).limit(1)
  if (!row) throw new Error('Esta solicitud no existe')

  await db.insert(reports).values({
    requestId: row.id,
    reason: reason.trim().slice(0, 500),
    ipHash: hashIp(ip),
  })
  // Un reporte no oculta nada por sí solo: lo decide una persona en /admin.
  await db.update(requests).set({ needsReview: true }).where(eq(requests.id, row.id))
}

export type ModerationRow = {
  publicCode: string
  title: string
  cityName: string
  status: RequestStatus
  isHidden: boolean
  needsReview: boolean
  reportCount: number
  createdAt: Date
}

export async function listForModeration(): Promise<ModerationRow[]> {
  const rows = await db
    .select({
      publicCode: requests.publicCode,
      title: requests.title,
      cityName: cities.name,
      status: requests.status,
      isHidden: requests.isHidden,
      needsReview: requests.needsReview,
      createdAt: requests.createdAt,
      reportCount: sql<number>`(
        select count(*)::int from ${reports} where request_id = ${requests.id}
      )`,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .orderBy(desc(requests.needsReview), desc(requests.createdAt))
    .limit(200)

  return rows as ModerationRow[]
}

export async function setHidden(code: string, hidden: boolean): Promise<void> {
  await db.update(requests)
    .set({ isHidden: hidden, needsReview: false })
    .where(eq(requests.publicCode, code))
}
