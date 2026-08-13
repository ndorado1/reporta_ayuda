import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, requestItems, claims, events, reports } from '@/db/schema'
import { createRequest, deleteRequest, reportRequest, getRequestByCode } from './requests'
import { claimRequest } from './claims'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = {
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }, { name: 'Arroz', quantity: '2 kg' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  acceptsPrivacy: true as const,
  website: '',
}

describe('deleteRequest', () => {
  it('borra la solicitud y deja de encontrarse', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    expect(await deleteRequest(created.publicCode)).toBe(true)

    expect(await getRequestByCode(created.publicCode)).toBeNull()
    expect(await testDb.select().from(requests)).toHaveLength(0)
  })

  // Sin el borrado en cascada quedarían filas apuntando a una solicitud que ya
  // no existe. Las de `claims` son las que importan: guardan el nombre del
  // voluntario, un dato personal que también hay que borrar.
  it('se lleva por delante ítems, ofrecimientos, eventos y reportes', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await claimRequest({ publicCode: created.publicCode, volunteerName: 'Luis Pérez' }, '2.2.2.2')
    await reportRequest(created.publicCode, 'contenido falso', '3.3.3.3')

    // Antes de borrar hay algo en las cuatro tablas: si no, la prueba pasaría
    // sin comprobar nada.
    expect(await testDb.select().from(requestItems)).not.toHaveLength(0)
    expect(await testDb.select().from(claims)).not.toHaveLength(0)
    expect(await testDb.select().from(events)).not.toHaveLength(0)
    expect(await testDb.select().from(reports)).not.toHaveLength(0)

    await deleteRequest(created.publicCode)

    expect(await testDb.select().from(requestItems)).toHaveLength(0)
    expect(await testDb.select().from(claims)).toHaveLength(0)
    expect(await testDb.select().from(events)).toHaveLength(0)
    expect(await testDb.select().from(reports)).toHaveLength(0)
  })

  it('devuelve false con un código que no existe, sin tocar nada', async () => {
    await seedTestCity()
    await createRequest(input, '1.1.1.1')

    expect(await deleteRequest('NOEXISTE')).toBe(false)

    expect(await testDb.select().from(requests)).toHaveLength(1)
  })
})
