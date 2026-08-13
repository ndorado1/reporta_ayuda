import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { claims, requests } from '@/db/schema'
import { eq } from 'drizzle-orm'
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
})
