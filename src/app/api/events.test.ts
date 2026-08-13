import { describe, it, expect, beforeEach } from 'vitest'
import { resetTestDb, seedTestCity, testDb } from '@/test/db'
import { requests } from '@/db/schema'
import { recordEvent } from '@/lib/events'
import { GET } from './events/route'

beforeEach(resetTestDb)

describe('GET /api/events', () => {
  it('ignora un "desde" que no es un uuid válido y devuelve el feed completo en vez de fallar', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values({
      cityId: city.id, publicCode: 'AAA111', manageTokenHash: 'h',
      title: 'Agua', requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
    }).returning()
    await recordEvent({
      type: 'request_created', requestId: req.id, cityId: city.id,
      payload: { title: 'Agua', neighborhood: null, city: 'Cali' },
    })

    const res = await GET(new Request('http://localhost/api/events?desde=no-es-un-uuid'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.events).toHaveLength(1)
  })
})
