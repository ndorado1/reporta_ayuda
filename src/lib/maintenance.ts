import { and, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { claims, requests } from '@/db/schema'

export const ANONYMIZE_AFTER_DAYS = 60
export const ARCHIVE_AFTER_DAYS = 14

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/**
 * Borra los datos personales de las solicitudes cerradas hace más de 60 días.
 * Conserva ciudad, barrio, ítems y fechas, que sirven para entender qué faltó.
 * Idempotente: `anonymized_at` marca lo ya procesado.
 *
 * También anonimiza el nombre de los voluntarios (`claims.volunteerName`)
 * asociados a esas solicitudes: bajo la Ley 1581 de 2012 tienen el mismo
 * derecho al olvido que quien pidió ayuda, y sin esto el nombre quedaba en
 * la tabla `claims` para siempre, incluso después de anonimizar la
 * solicitud a la que pertenece.
 */
export async function anonymizeOldRequests(): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
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

    if (rows.length > 0) {
      await tx
        .update(claims)
        .set({ volunteerName: 'Anónimo' })
        .where(inArray(claims.requestId, rows.map((r) => r.id)))
    }

    return rows.length
  })
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
