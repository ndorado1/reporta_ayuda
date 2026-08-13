import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { claims, requests } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { claimRequest, cancelClaim, expireStaleClaims } from './claims'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

async function makeRequest() {
  const city = await seedTestCity()
  const [row] = await testDb.insert(requests).values({
    cityId: city.id, publicCode: 'AAA111', manageTokenHash: 'h',
    title: 'Agua', requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
  }).returning()
  return row
}

describe('claimRequest', () => {
  it('pasa la solicitud a en_atencion', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('devuelve un token que identifica al voluntario', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    expect(claimToken.length).toBeGreaterThan(20)
  })

  it('impide reclamar una solicitud ya reclamada', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await expect(
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Marta' }, '2.2.2.2')
    ).rejects.toThrow(/ya está siendo atendida/i)
  })

  it('falla si la solicitud no existe', async () => {
    await expect(
      claimRequest({ publicCode: 'ZZZ999', volunteerName: 'Luis' }, '1.1.1.1')
    ).rejects.toThrow(/no existe/i)
  })

  it('maneja dos reclamos simultáneos: uno gana y el otro recibe el mensaje en español', async () => {
    await makeRequest()

    const results = await Promise.allSettled([
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1'),
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Marta' }, '2.2.2.2'),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const [{ reason }] = rejected as PromiseRejectedResult[]
    expect(reason).toBeInstanceOf(Error)
    expect(reason.message).toMatch(/ya está siendo atendida/i)
  })
})

describe('cancelClaim', () => {
  it('devuelve la solicitud a abierta', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await cancelClaim('AAA111', claimToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('abierta')
  })

  it('rechaza a quien no tiene el token del claim', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await expect(cancelClaim('AAA111', 'token-ajeno')).rejects.toThrow(/no autorizado/i)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('permite que otra persona reclame después de la cancelación', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await cancelClaim('AAA111', claimToken)

    await expect(
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Marta' }, '2.2.2.2')
    ).resolves.toBeDefined()
  })
})

describe('expireStaleClaims', () => {
  it('vence los claims cumplidos y reabre la solicitud', async () => {
    const req = await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    expect(claimToken).toBeDefined()

    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    expect(await expireStaleClaims()).toBe(1)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('abierta')
    const [claim] = await testDb.select().from(claims)
    expect(claim.status).toBe('vencido')
  })

  it('no toca los claims vigentes', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')

    expect(await expireStaleClaims()).toBe(0)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('es idempotente', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    await expireStaleClaims()
    expect(await expireStaleClaims()).toBe(0)
  })

  it('no reabre una solicitud que ya fue atendida', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(requests).set({ status: 'atendida' }).where(eq(requests.id, req.id))
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    await expireStaleClaims()

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('atendida')
  })

  it('no deja ninguna solicitud en_atencion sin un claim activo asociado', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    // Segunda solicitud con un claim vigente: sin esto, tras expireStaleClaims()
    // la única solicitud en_atencion pasa a abierta y la consulta de abajo
    // devuelve una lista vacía, con lo que el bucle de aserciones nunca se
    // ejecuta y la prueba "pasa" sin comprobar nada.
    const city = await seedTestCity()
    const [req2] = await testDb.insert(requests).values({
      cityId: city.id, publicCode: 'BBB222', manageTokenHash: 'h',
      title: 'Comida', requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
    }).returning()
    await claimRequest({ publicCode: 'BBB222', volunteerName: 'Marta' }, '2.2.2.2')

    await expireStaleClaims()

    const enAtencion = await testDb.select().from(requests).where(eq(requests.status, 'en_atencion'))
    expect(enAtencion.length).toBeGreaterThan(0)
    for (const r of enAtencion) {
      const activeClaims = await testDb.select().from(claims)
        .where(and(eq(claims.requestId, r.id), eq(claims.status, 'activo')))
      expect(activeClaims.length).toBeGreaterThan(0)
    }

    // La solicitud con claim vigente no debió tocarse.
    const [row2] = await testDb.select().from(requests).where(eq(requests.id, req2.id))
    expect(row2.status).toBe('en_atencion')
  })

  it('revierte el vencimiento del claim si falla la reapertura de la solicitud', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    // Fuerza un fallo en la segunda escritura (reabrir la solicitud) para
    // demostrar que la transacción revierte también la primera (vencer el
    // claim). db y tx heredan `update` del mismo PgDatabase.prototype, así
    // que interceptarlo ahí alcanza a tx.update dentro de la transacción.
    const originalUpdate = PgDatabase.prototype.update
    const spy = vi.spyOn(PgDatabase.prototype, 'update')
      .mockImplementation(function (this: unknown, ...args: Parameters<typeof originalUpdate>) {
        if (args[0] === requests) throw new Error('fallo simulado de base de datos')
        return originalUpdate.apply(this, args)
      })

    try {
      await expect(expireStaleClaims()).rejects.toThrow(/fallo simulado/)
    } finally {
      spy.mockRestore()
    }

    const [claim] = await testDb.select().from(claims).where(eq(claims.requestId, req.id))
    expect(claim.status).toBe('activo')

    const [row] = await testDb.select().from(requests).where(eq(requests.id, req.id))
    expect(row.status).toBe('en_atencion')
  })
})
