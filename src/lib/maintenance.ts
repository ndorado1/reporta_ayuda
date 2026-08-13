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
      // Igual que en cancelRequest (requests.ts): la descripción es texto
      // libre y suele contener lo mismo que el resto de datos personales.
      description: null,
      // Redondea a ~1 km para que no se pueda ubicar la vivienda.
      lat: sql`round(${requests.lat}::numeric, 2)::double precision`,
      lng: sql`round(${requests.lng}::numeric, 2)::double precision`,
      anonymizedAt: new Date(),
    })
    .where(and(
      inArray(requests.status, ['atendida', 'cancelada']),
      // El corte cuenta desde el cierre real (fulfilledAt), no desde updatedAt:
      // una edición posterior (moderación, corrección de un ítem) no puede
      // reiniciar el plazo que la política de datos promete a los damnificados.
      // cancelada no fija fulfilledAt, así que cae a updatedAt, que en ese caso
      // sí es el momento del cierre.
      sql`coalesce(${requests.fulfilledAt}, ${requests.updatedAt}) < ${daysAgo(ANONYMIZE_AFTER_DAYS).toISOString()}::timestamptz`,
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
