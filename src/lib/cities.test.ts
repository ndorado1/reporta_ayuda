import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb } from '@/test/db'
import { cities } from '@/db/schema'
import { listCities, getCityBySlug } from './cities'

beforeEach(async () => {
  await resetTestDb()
  await testDb.insert(cities).values([
    { slug: 'cali', name: 'Cali', department: 'Valle del Cauca', centerLat: 3.4516, centerLng: -76.532, position: 1 },
    { slug: 'armenia', name: 'Armenia', department: 'Quindío', centerLat: 4.5339, centerLng: -75.6811, position: 2 },
    { slug: 'inactiva', name: 'Inactiva', department: 'X', centerLat: 0, centerLng: 0, position: 3, isActive: false },
  ])
})

describe('listCities', () => {
  it('devuelve solo las activas, en orden', async () => {
    const result = await listCities()
    expect(result.map((c) => c.slug)).toEqual(['cali', 'armenia'])
  })
})

describe('getCityBySlug', () => {
  it('encuentra una ciudad activa', async () => {
    expect((await getCityBySlug('cali'))?.name).toBe('Cali')
  })

  it('devuelve null si no existe o está inactiva', async () => {
    expect(await getCityBySlug('medellin')).toBeNull()
    expect(await getCityBySlug('inactiva')).toBeNull()
  })
})
