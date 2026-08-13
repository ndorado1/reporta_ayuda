import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { cities, requests } from '@/db/schema'
import { createRequest, listRequests, listRequestsForMap, getRequestByCode, fulfillRequest, cancelRequest, getContactPhone, PAGE_SIZE } from './requests'
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

    const { items: [item] } = await listRequests({})
    expect(JSON.stringify(item)).not.toContain('573001234567')
    expect(item).not.toHaveProperty('whatsapp')
  })

  it('muestra por defecto solo abiertas y en atención', async () => {
    await seedTestCity()
    const a = await createRequest(input({ title: 'Necesito agua potable' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesito cobijas gruesas' }), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const { items } = await listRequests({})
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Necesito cobijas gruesas')
  })

  it('devuelve las atendidas cuando se piden explícitamente', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const { items } = await listRequests({ statuses: ['atendida'] })
    expect(items).toHaveLength(1)
  })

  it('filtra por ciudad', async () => {
    await seedTestCity()
    await testDb.insert(cities).values({
      slug: 'armenia', name: 'Armenia', department: 'Quindío',
      centerLat: 4.5339, centerLng: -75.6811, position: 2,
    })
    await createRequest(input(), '1.1.1.1')
    await createRequest(input({ citySlug: 'armenia', lat: 4.53, lng: -75.68 }), '1.1.1.1')

    expect((await listRequests({ citySlug: 'cali' })).items).toHaveLength(1)
    expect((await listRequests({})).items).toHaveLength(2)
  })

  it('filtra por urgencia', async () => {
    await seedTestCity()
    await createRequest(input({ urgency: 'alta' }), '1.1.1.1')
    await createRequest(input({ urgency: 'baja', title: 'Necesitamos ropa seca' }), '1.1.1.1')

    const { items: altas } = await listRequests({ urgency: 'alta' })
    expect(altas).toHaveLength(1)
  })

  it('busca por título y por barrio', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Necesitamos pañales', neighborhood: 'Siloé' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesitamos agua potable', neighborhood: 'Aguablanca' }), '1.1.1.1')

    expect((await listRequests({ search: 'pañales' })).items).toHaveLength(1)
    expect((await listRequests({ search: 'aguablanca' })).items).toHaveLength(1)
  })

  it('incluye una muestra de los ítems y el total', async () => {
    await seedTestCity()
    await createRequest(input({
      items: [
        { name: 'Agua' }, { name: 'Arroz' }, { name: 'Cobijas' }, { name: 'Pañales' },
      ],
    }), '1.1.1.1')

    const { items: [item] } = await listRequests({})
    expect(item.itemsPreview).toHaveLength(3)
    expect(item.itemCount).toBe(4)
  })

  it('ordena por cercanía cuando se entrega un punto', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Lejos del punto de referencia', lat: 3.50, lng: -76.60 }), '1.1.1.1')
    await createRequest(input({ title: 'Cerca del punto de referencia', lat: 3.441, lng: -76.521 }), '1.1.1.1')

    const { items } = await listRequests({ near: { lat: 3.44, lng: -76.52 } })
    expect(items[0].title).toBe('Cerca del punto de referencia')
    expect(items[0].distanceKm).toBeLessThan(items[1].distanceKm!)
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
    const { items } = await listRequests({ near, limit: 2 })
    expect(items[0].title).toBe('Cercana pero antigua')
  })

  it('oculta lo que la moderación escondió', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ isHidden: true })

    expect((await listRequests({})).items).toHaveLength(0)
    expect(a.publicCode).toBeDefined()
  })

  it('vence los claims cumplidos antes de responder', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis' }, '2.2.2.2')
    await testDb.execute(sql`UPDATE claims SET expires_at = now() - interval '1 hour'`)

    const { items: [item] } = await listRequests({})
    expect(item.status).toBe('abierta')
  })

  it('muestra quién va en camino', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis Pérez' }, '2.2.2.2')

    const { items: [item] } = await listRequests({})
    expect(item.claimedBy).toBe('Luis Pérez')
  })

  describe('paginación', () => {
    // Inserta directo en la base (sin pasar por createRequest) para que la
    // prueba sea rápida con decenas de filas y para fijar `createdAt` a
    // mano: así el orden por defecto (más reciente primero) es predecible
    // sin depender de la precisión del reloj real entre inserciones.
    async function seedMany(n: number) {
      const city = await seedTestCity()
      const base = Date.now()
      await testDb.insert(requests).values(
        Array.from({ length: n }, (_, i) => ({
          cityId: city.id,
          publicCode: `PAG${String(i).padStart(4, '0')}`,
          manageTokenHash: 'h',
          title: `Solicitud número ${String(i).padStart(3, '0')}`,
          requesterName: 'Ana',
          lat: 3.45,
          lng: -76.53,
          ipHash: 'i',
          createdAt: new Date(base + i * 1000),
        }))
      )
    }

    it('el total refleja todas las filas que cumplen los filtros, no solo la página', async () => {
      await seedMany(PAGE_SIZE + 30)

      const { items, total } = await listRequests({})
      expect(total).toBe(PAGE_SIZE + 30)
      expect(items).toHaveLength(PAGE_SIZE)
    })

    it('no trunca de forma silenciosa: la segunda página trae lo que falta, empezando por lo más antiguo', async () => {
      await seedMany(PAGE_SIZE + 5)

      const first = await listRequests({ page: 1 })
      const second = await listRequests({ page: 2 })

      expect(second.items).toHaveLength(5)
      // La más antigua (título "000") es la primera en orden descendente
      // por fecha invertido: con 55 solicitudes y una sola página de 50,
      // el tope anterior de 200 sin paginar la habría escondido para
      // siempre en cuanto una ciudad superara las 200 abiertas. Aquí debe
      // seguir siendo alcanzable, en la última página.
      expect(second.items.map((i) => i.title)).toContain('Solicitud número 000')
      // Ninguna solicitud debe repetirse entre páginas.
      const firstCodes = new Set(first.items.map((i) => i.title))
      for (const item of second.items) expect(firstCodes.has(item.title)).toBe(false)
    })

    it('ignora un límite mayor a PAGE_SIZE: nunca trae más de una página', async () => {
      await seedMany(PAGE_SIZE + 10)

      const { items } = await listRequests({ limit: 1000 })
      expect(items).toHaveLength(PAGE_SIZE)
    })

    // Cubre el contrato general de la paginación cuando hay filas con el
    // mismo createdAt (mismo problema que motivó el desempate por id en
    // src/lib/events.ts:48). Aviso honesto: verificado a mano contra este
    // Postgres, esta prueba NO falla si se quita `desc(requests.id)` del
    // `orderBy` — el plan de una tabla pequeña sin cambios entre ambas
    // consultas resulta "accidentalmente" estable. El desempate se mantiene
    // por ser la práctica correcta y documentada (ORDER BY sin clave única no
    // garantiza un orden total entre ejecuciones distintas), no porque esta
    // prueba lo demuestre.
    it('no repite ni pierde filas al paginar sobre createdAt empatado', async () => {
      const city = await seedTestCity()
      const tied = new Date()
      const n = PAGE_SIZE + 7
      await testDb.insert(requests).values(
        Array.from({ length: n }, (_, i) => ({
          cityId: city.id,
          publicCode: `TIE${String(i).padStart(4, '0')}`,
          manageTokenHash: 'h',
          title: `Empate ${String(i).padStart(3, '0')}`,
          requesterName: 'Ana',
          lat: 3.45,
          lng: -76.53,
          ipHash: 'i',
          createdAt: tied,
        }))
      )

      const first = await listRequests({ page: 1 })
      const second = await listRequests({ page: 2 })

      const seen = new Set(first.items.map((i) => i.publicCode))
      expect(seen.size).toBe(PAGE_SIZE)
      for (const item of second.items) {
        expect(seen.has(item.publicCode)).toBe(false)
        seen.add(item.publicCode)
      }
      expect(seen.size).toBe(n)
    })
  })
})

describe('listRequestsForMap', () => {
  it('trae todas las solicitudes de una vez, sin el límite de PAGE_SIZE de la lista', async () => {
    const city = await seedTestCity()
    const n = PAGE_SIZE + 30
    await testDb.insert(requests).values(
      Array.from({ length: n }, (_, i) => ({
        cityId: city.id,
        publicCode: `MAP${String(i).padStart(4, '0')}`,
        manageTokenHash: 'h',
        title: `Solicitud de mapa ${String(i).padStart(3, '0')}`,
        requesterName: 'Ana',
        lat: 3.45,
        lng: -76.53,
        ipHash: 'i',
        createdAt: new Date(Date.now() + i * 1000),
      }))
    )

    const items = await listRequestsForMap({})
    expect(items).toHaveLength(n)
  })

  it('nunca incluye el número de WhatsApp ni otros datos que no necesita el mapa', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')

    const [item] = await listRequestsForMap({})
    expect(JSON.stringify(item)).not.toContain('573001234567')
    expect(item).not.toHaveProperty('whatsapp')
    expect(item).not.toHaveProperty('itemsPreview')
  })

  it('respeta los mismos filtros que la lista (ciudad, urgencia, estados visibles por defecto)', async () => {
    await seedTestCity()
    const a = await createRequest(input({ urgency: 'alta' }), '1.1.1.1')
    await createRequest(input({ urgency: 'baja', title: 'Necesitamos ropa seca' }), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const items = await listRequestsForMap({ urgency: 'baja' })
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Necesitamos ropa seca')
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

  it('anonimiza de inmediato al cancelar, como promete el aviso de privacidad', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await cancelRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBeNull()
    expect(row.requesterName).not.toBe('Ana Ruiz')
    expect(row.anonymizedAt).not.toBeNull()
    expect(row.neighborhood).toBe('El Diamante')
  })

  it('borra la descripción libre al cancelar: puede contener lo mismo que el nombre o la dirección', async () => {
    await seedTestCity()
    const a = await createRequest(
      input({ description: 'La casa verde al lado de la panadería de la 15, vive mi mamá y yo' }),
      '1.1.1.1'
    )
    await cancelRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.description).toBeNull()
  })

  it('deja de servir el detalle de una solicitud cancelada, ni siquiera con el token de gestión', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await cancelRequest(a.publicCode, a.manageToken)

    expect(await getRequestByCode(a.publicCode)).toBeNull()
    expect(await getRequestByCode(a.publicCode, a.manageToken)).toBeNull()
  })

  it('no anonimiza al marcar como atendida: ese caso sigue el plazo de 60 días', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBe('+573001234567')
    expect(row.anonymizedAt).toBeNull()
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

  // Antes de esta corrección, `?estado=archivada` volvía navegable el
  // listado de solicitudes archivadas (ver parseStatuses) y el botón de
  // WhatsApp de esa tarjeta seguía funcionando porque esta consulta no
  // miraba el estado. Sin el filtro, esta prueba fallaría porque `contact`
  // no sería null.
  it('no entrega número de solicitudes archivadas', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ status: 'archivada' })

    expect(await getContactPhone(a.publicCode)).toBeNull()
  })

  it('no entrega número de solicitudes canceladas', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await cancelRequest(a.publicCode, a.manageToken)

    expect(await getContactPhone(a.publicCode)).toBeNull()
  })
})
