import { z } from 'zod'
import { db } from '@/db'
import { cities, claims, events, requestItems, requests } from '@/db/schema'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { generatePublicCode, generateToken, hashIp, hashToken, verifyToken } from './tokens'
import { normalizePhone } from './whatsapp'
import { distanceKm, isNearCity, type Coords } from './geo'
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
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(desc(requests.createdAt))
    .limit(Math.min(filters.limit ?? 200, 200))

  const items = rows as unknown as RequestListItem[]

  if (!filters.near) return items

  return items
    .map((item) => ({
      ...item,
      distanceKm: distanceKm(filters.near!, { lat: item.lat, lng: item.lng }),
    }))
    .sort((a, b) => a.distanceKm! - b.distanceKm!)
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

  const [row] = await db
    .select({ request: requests, cityName: cities.name, citySlug: cities.slug })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(eq(requests.publicCode, code), eq(requests.isHidden, false)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select({ name: requestItems.name, quantity: requestItems.quantity })
    .from(requestItems)
    .where(eq(requestItems.requestId, row.request.id))
    .orderBy(requestItems.position)

  const [claim] = await db
    .select({ volunteerName: claims.volunteerName })
    .from(claims)
    .where(and(eq(claims.requestId, row.request.id), eq(claims.status, 'activo')))
    .limit(1)

  const r = row.request
  return {
    publicCode: r.publicCode,
    title: r.title,
    description: r.description,
    urgency: r.urgency,
    status: r.status,
    neighborhood: r.neighborhood,
    addressText: r.addressText,
    requesterName: r.requesterName,
    peopleCount: r.peopleCount,
    lat: r.lat,
    lng: r.lng,
    cityName: row.cityName,
    citySlug: row.citySlug,
    items,
    itemCount: items.length,
    claimedBy: claim?.volunteerName ?? null,
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt,
    canManage: manageToken ? verifyToken(manageToken, r.manageTokenHash) : false,
  }
}

async function requireOwner(code: string, manageToken: string) {
  const [row] = await db
    .select({ request: requests, cityName: cities.name })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, code))
    .limit(1)

  if (!row) throw new Error('Esta solicitud no existe')
  if (!verifyToken(manageToken, row.request.manageTokenHash)) throw new Error('No autorizado')
  return row
}

export async function fulfillRequest(code: string, manageToken: string): Promise<void> {
  const { request, cityName } = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    await tx.update(requests)
      .set({ status: 'atendida', fulfilledAt: new Date(), updatedAt: new Date() })
      .where(eq(requests.id, request.id))

    await tx.update(claims)
      .set({ status: 'completado' })
      .where(and(eq(claims.requestId, request.id), eq(claims.status, 'activo')))

    await tx.insert(events).values({
      type: 'request_fulfilled',
      requestId: request.id,
      cityId: request.cityId,
      payload: { title: request.title, neighborhood: request.neighborhood, city: cityName },
    })
  })
}

export async function cancelRequest(code: string, manageToken: string): Promise<void> {
  const { request } = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    await tx.update(requests)
      .set({ status: 'cancelada', updatedAt: new Date() })
      .where(eq(requests.id, request.id))
    await tx.update(claims)
      .set({ status: 'cancelado' })
      .where(and(eq(claims.requestId, request.id), eq(claims.status, 'activo')))
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
