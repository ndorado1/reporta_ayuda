import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, claims, requestItems } from './schema'

beforeEach(resetTestDb)

const baseRequest = (cityId: string) => ({
  cityId,
  publicCode: 'ABC123',
  manageTokenHash: 'hash',
  title: 'Necesitamos agua',
  requesterName: 'Ana',
  whatsapp: '+573001234567',
  lat: 3.45,
  lng: -76.53,
  ipHash: 'iphash',
})

describe('esquema', () => {
  it('guarda una solicitud con los valores por defecto esperados', async () => {
    const city = await seedTestCity()
    const [row] = await testDb.insert(requests).values(baseRequest(city.id)).returning()

    expect(row.status).toBe('abierta')
    expect(row.urgency).toBe('media')
    expect(row.isHidden).toBe(false)
    expect(row.needsReview).toBe(false)
  })

  it('impide dos códigos públicos iguales', async () => {
    const city = await seedTestCity()
    await testDb.insert(requests).values(baseRequest(city.id))
    await expect(
      testDb.insert(requests).values(baseRequest(city.id))
    ).rejects.toThrow()
  })

  it('impide dos claims activos sobre la misma solicitud', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    const claim = {
      requestId: req.id,
      volunteerName: 'Luis',
      claimTokenHash: 'h',
      ipHash: 'i',
      expiresAt: new Date(Date.now() + 6 * 3600_000),
    }

    await testDb.insert(claims).values(claim)
    await expect(testDb.insert(claims).values(claim)).rejects.toThrow()
  })

  it('permite un segundo claim si el anterior ya no está activo', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    const base = {
      requestId: req.id,
      volunteerName: 'Luis',
      claimTokenHash: 'h',
      ipHash: 'i',
      expiresAt: new Date(Date.now() + 6 * 3600_000),
    }

    await testDb.insert(claims).values({ ...base, status: 'cancelado' })
    await expect(testDb.insert(claims).values(base)).resolves.toBeDefined()
  })

  it('borra los ítems al borrar la solicitud', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    await testDb.insert(requestItems).values({ requestId: req.id, name: 'Agua' })
    await testDb.delete(requests)
    const left = await testDb.select().from(requestItems)
    expect(left).toHaveLength(0)
  })
})
