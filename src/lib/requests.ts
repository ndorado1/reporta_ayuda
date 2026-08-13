import { z } from 'zod'
import { db } from '@/db'
import { cities, claims, events, reports, requestItems, requests } from '@/db/schema'
import { and, count, desc, eq, ilike, inArray, ne, notInArray, or, sql } from 'drizzle-orm'
import { generatePublicCode, generateToken, hashIp, hashToken, verifyToken } from './tokens'
import { normalizePhone } from './whatsapp'
import { isNearCity, type Coords } from './geo'
import { consumeRate } from './ratelimit'
import { expireStaleClaims } from './claims'
import { DomainError } from './errors'

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
  if (!city || !city.isActive) throw new DomainError('La ciudad seleccionada no está disponible')

  const phone = normalizePhone(input.whatsapp)
  if (!phone) throw new DomainError('El número debe ser un celular colombiano de diez dígitos')

  if (!isNearCity({ lat: input.lat, lng: input.lng }, { lat: city.centerLat, lng: city.centerLng })) {
    throw new DomainError(`La ubicación marcada queda muy lejos de ${city.name}. Revisa el punto en el mapa.`)
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

// Listas cerradas de valores válidos, para que quien reciba un parámetro de
// la URL (page.tsx) pueda validarlo antes de pasarlo a una condición SQL
// sobre una columna enum. Un valor que no está aquí (p. ej. "atendidas" en
// plural) debe ignorarse, no llegar hasta Postgres: `inArray`/`eq` sobre un
// valor fuera del enum produce 22P02 y tumba la página para cualquiera que
// edite el enlace a mano.
export const REQUEST_STATUSES: RequestStatus[] = ['abierta', 'en_atencion', 'atendida', 'cancelada', 'archivada']
export const URGENCIES: Urgency[] = ['alta', 'media', 'baja']

const VISIBLE_BY_DEFAULT: RequestStatus[] = ['abierta', 'en_atencion']

// 50 por página: con el tope anterior de 200 sin paginar, cualquier ciudad
// con más de 200 solicitudes abiertas perdía del listado —para siempre, sin
// aviso— exactamente las más antiguas, que son las que más tiempo llevan
// esperando.
export const PAGE_SIZE = 50

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
  /** Página de 1 en adelante. Por defecto 1. */
  page?: number
  /** Tamaño de página; se limita a PAGE_SIZE incluso si se pide más. */
  limit?: number
}

export type RequestListResult = {
  items: RequestListItem[]
  /** Total real de filas que cumplen los filtros, no `items.length`. */
  total: number
}

/** Filtros del mapa: los mismos que el listado, sin paginación ni cercanía. */
export type MapFilters = Pick<ListFilters, 'citySlug' | 'statuses' | 'urgency' | 'search'>

export type MapRequestItem = {
  publicCode: string
  title: string
  urgency: Urgency
  neighborhood: string | null
  lat: number
  lng: number
}

// El mapa es la vía principal del voluntario (ver spec) y no se pagina: un
// mapa que solo muestra la primera página esconde justo lo más antiguo, lo
// que lleva más tiempo esperando. En su lugar trae hasta MAP_LIMIT filas de
// una vez, con una proyección liviana (sin ítems, sin claimedBy, sin
// distancia) — a este volumen es barato, y 2.000 da margen de sobra sobre
// las ~900 solicitudes actuales.
export const MAP_LIMIT = 2000

/** Condiciones comunes a listRequests y listRequestsForMap. */
function buildListConditions(filters: MapFilters) {
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
  return conditions
}

export async function listRequests(filters: ListFilters): Promise<RequestListResult> {
  // Reabre lo abandonado antes de responder: la spec no usa cron para esto.
  await expireStaleClaims()

  const conditions = buildListConditions(filters)

  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const limit = Math.min(Math.max(1, Math.trunc(filters.limit ?? PAGE_SIZE)), PAGE_SIZE)
  const offset = (page - 1) * limit

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
    // Desempate por id: sin él, dos filas con el mismo createdAt (o, con
    // orden por cercanía, la misma distancia — los empates entre floats son
    // más fáciles) no tienen un orden total garantizado entre dos ejecuciones
    // distintas de la consulta. Con OFFSET/LIMIT paginando, eso puede
    // devolver una fila en ambas páginas o en ninguna. Mismo desempate que ya
    // usa src/lib/events.ts:48 para el mismo problema.
    .orderBy(
      near ? sql`${distanceExpr} asc` : desc(requests.createdAt),
      desc(requests.id)
    )
    .limit(limit)
    .offset(offset)

  // Total real sobre las mismas condiciones, no `rows.length`: con más de
  // una página de resultados, `rows.length` nunca pasa de `limit` y la
  // página mostraría "50 solicitudes" aunque hubiera 900.
  const [{ total }] = await db
    .select({ total: count() })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(...conditions))

  return {
    items: rows.map((row) => ({
      ...row,
      distanceKm: row.distanceKm ?? undefined,
    })) as unknown as RequestListItem[],
    total,
  }
}

/**
 * Todas las solicitudes que caben en el mapa a la vez, sin paginar. Misma
 * proyección mínima que necesita `RequestMap`: nada de ítems, nada de
 * `claimedBy`, nada de distancia. Los controles de paginación siguen
 * existiendo, pero solo para la vista de lista — pasear un mapa página por
 * página es mala interacción para quien busca dónde ayudar.
 */
export async function listRequestsForMap(filters: MapFilters): Promise<MapRequestItem[]> {
  await expireStaleClaims()

  const conditions = buildListConditions(filters)

  const rows = await db
    .select({
      publicCode: requests.publicCode,
      title: requests.title,
      urgency: requests.urgency,
      neighborhood: requests.neighborhood,
      lat: requests.lat,
      lng: requests.lng,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(desc(requests.createdAt), desc(requests.id))
    .limit(MAP_LIMIT)

  return rows
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
    .where(and(
      eq(requests.publicCode, code),
      eq(requests.isHidden, false),
      // Una solicitud cancelada debe desaparecer "de inmediato", como
      // promete el aviso de privacidad — no solo del listado, también de su
      // propia URL de detalle. Sin este filtro, `/s/{code}` seguía sirviendo
      // el registro completo (incluida la descripción, antes de la
      // corrección de arriba) para quien canceló justamente para dejar de
      // ser encontrable.
      ne(requests.status, 'cancelada')
    ))
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
      status: requests.status,
      neighborhood: requests.neighborhood,
      manageTokenHash: requests.manageTokenHash,
      cityName: cities.name,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, code))
    .limit(1)

  if (!row) throw new DomainError('Esta solicitud no existe')
  if (!verifyToken(manageToken, row.manageTokenHash)) throw new DomainError('No autorizado')
  return row
}

export const updateRequestSchema = createRequestSchema.pick({
  title: true,
  description: true,
  urgency: true,
  items: true,
  neighborhood: true,
  addressText: true,
})

export type UpdateRequestInput = z.input<typeof updateRequestSchema>

/**
 * No toca el WhatsApp ni la ciudad: cambiar el número por esta vía
 * permitiría secuestrar el contacto de una solicitud ajena si alguien
 * llegara a filtrar un enlace de gestión.
 */
export async function updateRequest(
  code: string,
  manageToken: string,
  raw: UpdateRequestInput
): Promise<void> {
  const patch = updateRequestSchema.parse(raw)
  const owner = await requireOwner(code, manageToken)

  // Una solicitud cerrada no se edita. Además de no tener sentido para el
  // usuario, editarla movería `updatedAt` y alteraría el reloj de
  // anonimización que la política de datos promete cumplir.
  if (owner.status !== 'abierta' && owner.status !== 'en_atencion') {
    throw new DomainError('Esta solicitud ya está cerrada y no se puede editar')
  }

  await db.transaction(async (tx) => {
    await tx.update(requests).set({
      title: patch.title,
      description: patch.description || null,
      urgency: patch.urgency,
      neighborhood: patch.neighborhood || null,
      addressText: patch.addressText || null,
      updatedAt: new Date(),
    }).where(eq(requests.id, owner.id))

    await tx.delete(requestItems).where(eq(requestItems.requestId, owner.id))
    await tx.insert(requestItems).values(
      patch.items.map((item, index) => ({
        requestId: owner.id,
        name: item.name,
        quantity: item.quantity || null,
        position: index,
      }))
    )
  })
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
        // La descripción es texto libre: ahí es justo donde la gente escribe
        // lo que la identifica ("la casa verde al lado de la panadería...").
        // El aviso de privacidad promete "sin nada que permita identificarte",
        // así que se borra igual que el nombre, el teléfono y la dirección.
        description: null,
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
    .where(and(
      eq(requests.publicCode, code),
      eq(requests.isHidden, false),
      // Una archivada nunca anonimiza el teléfono (solo cancelar y el
      // mantenimiento de 60 días lo hacen), así que sin este filtro el botón
      // de WhatsApp seguía funcionando para cualquiera que llegara al listado
      // navegable de `?estado=archivada`. `cancelada` ya queda cubierta
      // porque cancelar pone `whatsapp` en null, pero se excluye igual para
      // que esta función no dependa de ese efecto secundario.
      notInArray(requests.status, ['archivada', 'cancelada'])
    ))
    .limit(1)

  if (!row?.phone) return null
  return { phone: row.phone, title: row.title }
}

export async function reportRequest(code: string, reason: string, ip: string): Promise<void> {
  const [row] = await db.select({ id: requests.id }).from(requests)
    .where(eq(requests.publicCode, code)).limit(1)
  if (!row) throw new DomainError('Esta solicitud no existe')

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
