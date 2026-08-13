import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, requestItems } from '@/db/schema'
import { createRequest, updateRequest, getRequestByCode } from './requests'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = {
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  acceptsPrivacy: true as const,
  website: '',
}

const patch = {
  title: 'Ya tenemos agua, ahora faltan cobijas',
  urgency: 'media' as const,
  items: [{ name: 'Cobijas', quantity: '4' }],
  neighborhood: 'Siloé',
  description: '',
  addressText: '',
}

describe('updateRequest', () => {
  it('cambia los datos con el token correcto', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const detail = await getRequestByCode(created.publicCode)
    expect(detail?.title).toBe('Ya tenemos agua, ahora faltan cobijas')
    expect(detail?.urgency).toBe('media')
    expect(detail?.neighborhood).toBe('Siloé')
  })

  it('reemplaza la lista de ítems por completo', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const items = await testDb.select().from(requestItems)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Cobijas')
  })

  it('rechaza a quien no tiene el token', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await expect(
      updateRequest(created.publicCode, 'token-ajeno', patch)
    ).rejects.toThrow(/no autorizado/i)
  })

  it('no permite dejar la solicitud sin ítems', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await expect(
      updateRequest(created.publicCode, created.manageToken, { ...patch, items: [] })
    ).rejects.toThrow()
  })

  it('no cambia el número ni la ciudad', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBe('+573001234567')
  })

  it('renueva updatedAt, lo que aplaza el archivado automático', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await testDb.update(requests).set({ updatedAt: new Date('2026-01-01') })

    await updateRequest(created.publicCode, created.manageToken, patch)

    const [row] = await testDb.select().from(requests)
    expect(row.updatedAt.getFullYear()).toBe(new Date().getFullYear())
  })
})
