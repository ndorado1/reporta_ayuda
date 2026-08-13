import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, requestItems, events } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createRequest } from './requests'
import { verifyToken } from './tokens'
import { RATE_LIMITS } from './ratelimit'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = (citySlug = 'cali') => ({
  citySlug,
  title: 'Familia sin agua ni alimentos',
  description: 'Somos cuatro personas, dos son niños.',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }, { name: 'Cobijas', quantity: '4' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '300 123 4567',
  lat: 3.44,
  lng: -76.52,
  addressText: 'Calle 5 con carrera 20',
  neighborhood: 'El Diamante',
  peopleCount: 4,
  acceptsPrivacy: true,
  website: '',
})

describe('createRequest', () => {
  it('guarda la solicitud con su código y token', async () => {
    await seedTestCity()
    const result = await createRequest(input(), '1.1.1.1')

    const [row] = await testDb.select().from(requests)
    expect(row.publicCode).toBe(result.publicCode)
    expect(verifyToken(result.manageToken, row.manageTokenHash)).toBe(true)
  })

  it('normaliza el número a formato internacional', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBe('+573001234567')
  })

  it('guarda los ítems en orden', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const items = await testDb.select().from(requestItems)
    expect(items.map((i) => i.name).sort()).toEqual(['Agua', 'Cobijas'])
  })

  it('registra el evento de creación', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const [event] = await testDb.select().from(events)
    expect(event.type).toBe('request_created')
    expect(event.payload.city).toBe('Cali')
  })

  it('rechaza un número que no es celular colombiano', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), whatsapp: '6024851234' }, '1.1.1.1')
    ).rejects.toThrow(/celular/i)
  })

  it('rechaza si no se acepta la política de datos', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), acceptsPrivacy: false }, '1.1.1.1')
    ).rejects.toThrow()
  })

  it('rechaza una solicitud sin ítems', async () => {
    await seedTestCity()
    await expect(createRequest({ ...input(), items: [] }, '1.1.1.1')).rejects.toThrow()
  })

  it('rechaza un pin lejos de la ciudad elegida', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), lat: 4.711, lng: -74.0721 }, '1.1.1.1')
    ).rejects.toThrow(/ubicación/i)
  })

  it('rechaza una ciudad inexistente', async () => {
    await seedTestCity()
    await expect(createRequest(input('medellin'), '1.1.1.1')).rejects.toThrow(/ciudad/i)
  })

  it('descarta el envío si el campo trampa viene lleno', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), website: 'http://spam.example' }, '1.1.1.1')
    ).rejects.toThrow()
  })

  it('publica igual al superar el límite, pero marcada para revisión', async () => {
    await seedTestCity()
    let last
    for (let i = 0; i < RATE_LIMITS.create_request + 1; i++) {
      last = await createRequest(input(), '1.1.1.1')
    }
    expect(last!.needsReview).toBe(true)

    const rows = await testDb.select().from(requests).where(eq(requests.needsReview, true))
    expect(rows.length).toBeGreaterThan(0)
  })
})
