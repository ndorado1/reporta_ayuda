import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, cities, events } from '@/db/schema'
import { recordEvent, listEvents, countEventsSince } from './events'

async function makeRequest(cityId: string, code: string) {
  const [row] = await testDb.insert(requests).values({
    cityId, publicCode: code, manageTokenHash: 'h', title: 'Agua',
    requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
  }).returning()
  return row
}

beforeEach(resetTestDb)

describe('eventos', () => {
  it('registra un evento y lo devuelve en el feed', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')

    await recordEvent({
      type: 'request_created', requestId: req.id, cityId: city.id,
      payload: { title: 'Agua', neighborhood: 'El Poblado', city: 'Cali' },
    })

    const feed = await listEvents({})
    expect(feed).toHaveLength(1)
    expect(feed[0].payload.title).toBe('Agua')
  })

  it('ordena del más reciente al más antiguo', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const base = { requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } }

    await recordEvent({ ...base, type: 'request_created' })
    await recordEvent({ ...base, type: 'request_claimed' })

    const feed = await listEvents({})
    expect(feed[0].type).toBe('request_claimed')
  })

  it('filtra por ciudad', async () => {
    const cali = await seedTestCity()
    const [armenia] = await testDb.insert(cities).values({
      slug: 'armenia', name: 'Armenia', department: 'Quindío',
      centerLat: 4.53, centerLng: -75.68, position: 2,
    }).returning()

    const rCali = await makeRequest(cali.id, 'AAA111')
    const rArm = await makeRequest(armenia.id, 'BBB222')

    await recordEvent({ type: 'request_created', requestId: rCali.id, cityId: cali.id, payload: { title: 'Cali', neighborhood: null, city: 'Cali' } })
    await recordEvent({ type: 'request_created', requestId: rArm.id, cityId: armenia.id, payload: { title: 'Armenia', neighborhood: null, city: 'Armenia' } })

    const feed = await listEvents({ citySlug: 'cali' })
    expect(feed).toHaveLength(1)
    expect(feed[0].payload.city).toBe('Cali')
  })

  it('cuenta los eventos posteriores a uno dado', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const base = { requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } }

    const first = await recordEvent({ ...base, type: 'request_created' })
    await recordEvent({ ...base, type: 'request_claimed' })
    await recordEvent({ ...base, type: 'request_fulfilled' })

    expect(await countEventsSince({ sinceId: first.id })).toBe(2)
  })

  it('cuenta todo cuando no se conoce el último visto', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    await recordEvent({ type: 'request_created', requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } })

    expect(await countEventsSince({})).toBe(1)
  })

  it('cuenta el total real aunque haya más de 50 eventos', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const rows = Array.from({ length: 55 }, () => ({
      type: 'request_created' as const,
      requestId: req.id,
      cityId: city.id,
      payload: { title: 'x', neighborhood: null, city: 'Cali' },
    }))
    await testDb.insert(events).values(rows)

    expect(await countEventsSince({})).toBe(55)
  })

  it('si el sinceId no existe, cuenta todo en vez de nada', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    await recordEvent({
      type: 'request_created', requestId: req.id, cityId: city.id,
      payload: { title: 'x', neighborhood: null, city: 'Cali' },
    })

    const idInexistente = '00000000-0000-0000-0000-000000000000'
    expect(await countEventsSince({ sinceId: idInexistente })).toBe(1)
  })

  it('desempata por id cuando dos eventos comparten transacción y por tanto el mismo created_at', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const base = { requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } }

    await testDb.transaction(async (tx) => {
      await tx.insert(events).values({ ...base, type: 'request_created' })
      await tx.insert(events).values({ ...base, type: 'request_claimed' })
    })

    const feed = await listEvents({})
    expect(feed).toHaveLength(2)
    // now() de Postgres es por transacción: ambos comparten el mismo instante.
    expect(feed[0].createdAt.getTime()).toBe(feed[1].createdAt.getTime())

    // El primero del orden (desempatado por id) no tiene nada después.
    expect(await countEventsSince({ sinceId: feed[0].id })).toBe(0)
    // El segundo del orden sí tiene un evento después: el primero.
    expect(await countEventsSince({ sinceId: feed[1].id })).toBe(1)
  })
})
