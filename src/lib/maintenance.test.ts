import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, claims } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { runMaintenance, anonymizeOldRequests, archiveStaleRequests } from './maintenance'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

async function makeRequest(over: Record<string, unknown> = {}) {
  const city = await seedTestCity()
  const [row] = await testDb.insert(requests).values({
    cityId: city.id, publicCode: `C${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    manageTokenHash: 'h', title: 'Agua', requesterName: 'Ana',
    whatsapp: '+573001234567', addressText: 'Calle 5 #20-30',
    description: 'La casa verde al lado de la panadería, vive mi mamá y yo',
    neighborhood: 'El Diamante', lat: 3.45, lng: -76.53, ipHash: 'i',
    ...over,
  }).returning()
  return row
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

describe('anonymizeOldRequests', () => {
  it('borra los datos personales de lo cerrado hace más de 60 días', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })

    expect(await anonymizeOldRequests()).toBe(1)

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.whatsapp).toBeNull()
    expect(after.requesterName).toBe('Anónimo')
    expect(after.addressText).toBeNull()
    expect(after.description).toBeNull()
    expect(after.anonymizedAt).not.toBeNull()
  })

  it('conserva lo que sirve para estadística', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })
    await anonymizeOldRequests()

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.neighborhood).toBe('El Diamante')
    expect(after.cityId).toBe(row.cityId)
  })

  it('no toca lo cerrado hace poco', async () => {
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(10), updatedAt: daysAgo(10) })
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('no toca lo que sigue abierto, por antiguo que sea', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(200) })
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('es idempotente', async () => {
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })
    await anonymizeOldRequests()
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('cuenta desde el cierre real, no desde una edición posterior', async () => {
    // fulfilledAt marca el cierre hace 61 días, pero alguien editó la fila hace 2 días:
    // el corte de 60 días debe mirar fulfilledAt, no dejarse engañar por updatedAt.
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(2) })
    expect(await anonymizeOldRequests()).toBe(1)
  })

  // El voluntario tiene el mismo derecho al olvido que quien pidió ayuda
  // (Ley 1581 de 2012). Sin esto, `claims.volunteerName` quedaba en la base
  // para siempre, incluso después de anonimizar la solicitud a la que
  // pertenece.
  it('anonimiza también el nombre del voluntario en los claims asociados', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })
    await testDb.insert(claims).values({
      requestId: row.id,
      volunteerName: 'Luis Pérez',
      claimTokenHash: 'h',
      status: 'completado',
      ipHash: 'i',
      expiresAt: daysAgo(-1),
    })

    await anonymizeOldRequests()

    const [claim] = await testDb.select().from(claims).where(eq(claims.requestId, row.id))
    expect(claim.volunteerName).toBe('Anónimo')
  })

  it('no toca el nombre del voluntario de un claim cuya solicitud no se anonimiza todavía', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(10), updatedAt: daysAgo(10) })
    await testDb.insert(claims).values({
      requestId: row.id,
      volunteerName: 'Luis Pérez',
      claimTokenHash: 'h',
      status: 'completado',
      ipHash: 'i',
      expiresAt: daysAgo(-1),
    })

    await anonymizeOldRequests()

    const [claim] = await testDb.select().from(claims).where(eq(claims.requestId, row.id))
    expect(claim.volunteerName).toBe('Luis Pérez')
  })
})

describe('archiveStaleRequests', () => {
  it('archiva lo abierto sin movimiento en 14 días', async () => {
    const row = await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })

    expect(await archiveStaleRequests()).toBe(1)

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.status).toBe('archivada')
  })

  it('no archiva lo que tuvo movimiento reciente', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(3) })
    expect(await archiveStaleRequests()).toBe(0)
  })

  it('no archiva lo que está en atención', async () => {
    await makeRequest({ status: 'en_atencion', updatedAt: daysAgo(20) })
    expect(await archiveStaleRequests()).toBe(0)
  })

  it('es idempotente', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })
    await archiveStaleRequests()
    expect(await archiveStaleRequests()).toBe(0)
  })
})

describe('runMaintenance', () => {
  it('ejecuta ambas tareas y reporta el conteo', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })

    const result = await runMaintenance()
    expect(result).toEqual({ anonymized: 1, archived: 1 })
  })
})
