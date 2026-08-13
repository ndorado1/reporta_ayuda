import { describe, it, expect } from 'vitest'
import { distanceKm, isNearCity } from './geo'

const CALI = { lat: 3.4516, lng: -76.532 }
const BOGOTA = { lat: 4.711, lng: -74.0721 }
const JAMUNDI = { lat: 3.2606, lng: -76.5417 }

describe('distanceKm', () => {
  it('da cero para el mismo punto', () => {
    expect(distanceKm(CALI, CALI)).toBe(0)
  })

  it('calcula Cali–Bogotá en unos 300 km', () => {
    expect(distanceKm(CALI, BOGOTA)).toBeGreaterThan(280)
    expect(distanceKm(CALI, BOGOTA)).toBeLessThan(320)
  })

  it('es simétrica', () => {
    expect(distanceKm(CALI, BOGOTA)).toBeCloseTo(distanceKm(BOGOTA, CALI), 6)
  })
})

describe('isNearCity', () => {
  it('acepta un municipio vecino dentro del área de influencia', () => {
    expect(isNearCity(JAMUNDI, CALI)).toBe(true)
  })

  it('rechaza un pin en otra ciudad del país', () => {
    expect(isNearCity(BOGOTA, CALI)).toBe(false)
  })
})
