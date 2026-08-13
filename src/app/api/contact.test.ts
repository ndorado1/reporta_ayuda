import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { resetTestDb, seedTestCity } from '@/test/db'
import { createRequest } from '@/lib/requests'
import { POST } from './requests/[code]/contact/route'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = {
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua' }],
  requesterName: 'Ana',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  acceptsPrivacy: true as const,
  website: '',
}

function request() {
  return new Request('http://localhost/api/requests/X/contact', {
    method: 'POST',
    headers: { 'x-forwarded-for': '190.1.1.1' },
  })
}

describe('POST /api/requests/[code]/contact', () => {
  it('devuelve el enlace de WhatsApp con el título en el mensaje', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    const res = await POST(request(), { params: Promise.resolve({ code: created.publicCode }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.link).toContain('https://wa.me/573001234567')
    expect(decodeURIComponent(body.link)).toContain('Familia sin agua')
  })

  it('responde 404 para un código inexistente', async () => {
    const res = await POST(request(), { params: Promise.resolve({ code: 'ZZZ999' }) })
    expect(res.status).toBe(404)
  })

  it('responde 429 al pasarse del límite de consultas', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    const params = { params: Promise.resolve({ code: created.publicCode }) }

    let last: Response | undefined
    for (let i = 0; i < 45; i++) last = await POST(request(), params)

    expect(last!.status).toBe(429)
  })
})
