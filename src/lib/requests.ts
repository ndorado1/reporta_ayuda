import { z } from 'zod'
import { db } from '@/db'
import { cities, events, requestItems, requests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generatePublicCode, generateToken, hashIp, hashToken } from './tokens'
import { normalizePhone } from './whatsapp'
import { isNearCity } from './geo'
import { consumeRate } from './ratelimit'

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
