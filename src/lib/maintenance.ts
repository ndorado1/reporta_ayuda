import { and, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { requests } from '@/db/schema'

export const ANONYMIZE_AFTER_DAYS = 60
export const ARCHIVE_AFTER_DAYS = 14

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/**
 * Borra los datos personales de las solicitudes cerradas hace más de 60 días.
 * Conserva ciudad, barrio, ítems y fechas, que sirven para entender qué faltó.
 * Idempotente: `anonymized_at` marca lo ya procesado.
 */
export async function anonymizeOldRequests(): Promise<number> {
  const rows = await db
    .update(requests)
    .set({
      requesterName: 'Anónimo',
      whatsapp: null,
      addressText: null,
      // Redondea a ~1 km para que no se pueda ubicar la vivienda.
      lat: sql`round(${requests.lat}::numeric, 2)::double precision`,
      lng: sql`round(${requests.lng}::numeric, 2)::double precision`,
      anonymizedAt: new Date(),
    })
    .where(and(
      inArray(requests.status, ['atendida', 'cancelada']),
      lt(requests.updatedAt, daysAgo(ANONYMIZE_AFTER_DAYS)),
      isNull(requests.anonymizedAt)
    ))
    .returning({ id: requests.id })

  return rows.length
}

/** Saca del mapa las solicitudes abiertas que nadie tocó en dos semanas. */
export async function archiveStaleRequests(): Promise<number> {
  const rows = await db
    .update(requests)
    .set({ status: 'archivada' })
    .where(and(
      inArray(requests.status, ['abierta']),
      lt(requests.updatedAt, daysAgo(ARCHIVE_AFTER_DAYS))
    ))
    .returning({ id: requests.id })

  return rows.length
}

export async function runMaintenance(): Promise<{ anonymized: number; archived: number }> {
  return {
    anonymized: await anonymizeOldRequests(),
    archived: await archiveStaleRequests(),
  }
}
