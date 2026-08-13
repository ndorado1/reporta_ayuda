import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { cities, requests } from '@/db/schema'
import { createRequest, listRequests, getRequestByCode, fulfillRequest, cancelRequest, getContactPhone } from './requests'
import { claimRequest } from './claims'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = (over: Record<string, unknown> = {}) => ({
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  neighborhood: 'El Diamante',
  acceptsPrivacy: true as const,
  website: '',
  ...over,
})

describe('listRequests', () => {
  it('nunca incluye el número de WhatsApp', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')

    const [item] = await listRequests({})
    expect(JSON.stringify(item)).not.toContain('573001234567')
    expect(item).not.toHaveProperty('whatsapp')
  })

  it('muestra por defecto solo abiertas y en atención', async () => {
    await seedTestCity()
    const a = await createRequest(input({ title: 'Necesito agua potable' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesito cobijas gruesas' }), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const list = await listRequests({})
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Necesito cobijas gruesas')
  })

  it('devuelve las atendidas cuando se piden explícitamente', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const list = await listRequests({ statuses: ['atendida'] })
    expect(list).toHaveLength(1)
  })

  it('filtra por ciudad', async () => {
    await seedTestCity()
    await testDb.insert(cities).values({
      slug: 'armenia', name: 'Armenia', department: 'Quindío',
      centerLat: 4.5339, centerLng: -75.6811, position: 2,
    })
    await createRequest(input(), '1.1.1.1')
    await createRequest(input({ citySlug: 'armenia', lat: 4.53, lng: -75.68 }), '1.1.1.1')

    expect(await listRequests({ citySlug: 'cali' })).toHaveLength(1)
    expect(await listRequests({})).toHaveLength(2)
  })

  it('filtra por urgencia', async () => {
    await seedTestCity()
    await createRequest(input({ urgency: 'alta' }), '1.1.1.1')
    await createRequest(input({ urgency: 'baja', title: 'Necesitamos ropa seca' }), '1.1.1.1')

    const altas = await listRequests({ urgency: 'alta' })
    expect(altas).toHaveLength(1)
  })

  it('busca por título y por barrio', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Necesitamos pañales', neighborhood: 'Siloé' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesitamos agua potable', neighborhood: 'Aguablanca' }), '1.1.1.1')

    expect(await listRequests({ search: 'pañales' })).toHaveLength(1)
    expect(await listRequests({ search: 'aguablanca' })).toHaveLength(1)
  })

  it('incluye una muestra de los ítems y el total', async () => {
    await seedTestCity()
    await createRequest(input({
      items: [
        { name: 'Agua' }, { name: 'Arroz' }, { name: 'Cobijas' }, { name: 'Pañales' },
      ],
    }), '1.1.1.1')

    const [item] = await listRequests({})
    expect(item.itemsPreview).toHaveLength(3)
    expect(item.itemCount).toBe(4)
  })

  it('ordena por cercanía cuando se entrega un punto', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Lejos del punto de referencia', lat: 3.50, lng: -76.60 }), '1.1.1.1')
    await createRequest(input({ title: 'Cerca del punto de referencia', lat: 3.441, lng: -76.521 }), '1.1.1.1')

    const list = await listRequests({ near: { lat: 3.44, lng: -76.52 } })
    expect(list[0].title).toBe('Cerca del punto de referencia')
    expect(list[0].distanceKm).toBeLessThan(list[1].distanceKm!)
  })

  it('ordena por cercanía en la base, no solo en memoria, cuando hay más solicitudes que el límite', async () => {
    await seedTestCity()
    const near = { lat: 3.44, lng: -76.52 }
    await createRequest(input({ title: 'Cercana pero antigua', lat: 3.441, lng: -76.521 }), '1.1.1.1')
    await createRequest(input({ title: 'Lejana reciente 1', lat: 3.50, lng: -76.60 }), '1.1.1.1')
    await createRequest(input({ title: 'Lejana reciente 2', lat: 3.55, lng: -76.65 }), '1.1.1.1')
    await createRequest(input({ title: 'Lejana reciente 3', lat: 3.60, lng: -76.70 }), '1.1.1.1')

    // El límite es menor que el total: si el LIMIT se aplicara antes de
    // ordenar por distancia, la cercana-pero-antigua quedaría descartada.
    const list = await listRequests({ near, limit: 2 })
    expect(list[0].title).toBe('Cercana pero antigua')
  })

  it('oculta lo que la moderación escondió', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ isHidden: true })

    expect(await listRequests({})).toHaveLength(0)
    expect(a.publicCode).toBeDefined()
  })

  it('vence los claims cumplidos antes de responder', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis' }, '2.2.2.2')
    await testDb.execute(sql`UPDATE claims SET expires_at = now() - interval '1 hour'`)

    const [item] = await listRequests({})
    expect(item.status).toBe('abierta')
  })

  it('muestra quién va en camino', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis Pérez' }, '2.2.2.2')

    const [item] = await listRequests({})
    expect(item.claimedBy).toBe('Luis Pérez')
  })
})

describe('getRequestByCode', () => {
  it('devuelve el detalle sin el número', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const detail = await getRequestByCode(a.publicCode)
    expect(detail?.title).toBe('Familia sin agua ni alimentos')
    expect(JSON.stringify(detail)).not.toContain('573001234567')
    expect(detail?.canManage).toBe(false)
  })

  it('marca canManage con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const detail = await getRequestByCode(a.publicCode, a.manageToken)
    expect(detail?.canManage).toBe(true)
  })

  it('devuelve null si no existe', async () => {
    expect(await getRequestByCode('ZZZ999')).toBeNull()
  })
})

describe('cierre de solicitudes', () => {
  it('marca como atendida con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('atendida')
    expect(row.fulfilledAt).not.toBeNull()
  })

  it('rechaza a quien no tiene el token', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await expect(fulfillRequest(a.publicCode, 'token-ajeno')).rejects.toThrow(/no autorizado/i)
  })

  it('cancela con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await cancelRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('cancelada')
  })

  it('cierra también el claim activo al marcar atendida', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis' }, '2.2.2.2')
    await fulfillRequest(a.publicCode, a.manageToken)

    const rows = await testDb.select().from(requests)
    expect(rows[0].status).toBe('atendida')
  })
})

describe('getContactPhone', () => {
  it('devuelve el número solo por esta vía', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const contact = await getContactPhone(a.publicCode)
    expect(contact?.phone).toBe('+573001234567')
  })

  it('no entrega número de solicitudes ocultas', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ isHidden: true })

    expect(await getContactPhone(a.publicCode)).toBeNull()
  })
})
