import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, cities } from '@/db/schema'
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
})
