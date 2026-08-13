import { describe, it, expect } from 'vitest'
import { getClientIp } from './request-ip'

describe('getClientIp', () => {
  it('usa x-real-ip como fuente principal, aunque venga junto a un x-forwarded-for falsificado', () => {
    const h = new Headers({
      'x-real-ip': '190.2.2.2',
      'x-forwarded-for': 'lo-que-sea-que-mande-el-cliente',
    })
    expect(getClientIp(h)).toBe('190.2.2.2')
  })

  it('sin x-real-ip, toma la ÚLTIMA IP de x-forwarded-for (la que añade nuestro nginx)', () => {
    const h = new Headers({ 'x-forwarded-for': '190.1.1.1, 10.0.0.1' })
    expect(getClientIp(h)).toBe('10.0.0.1')
  })

  it('devuelve un marcador cuando no hay cabeceras', () => {
    expect(getClientIp(new Headers())).toBe('0.0.0.0')
  })

  it('un x-forwarded-for distinto en cada petición no cambia la IP resuelta cuando hay x-real-ip', () => {
    const resolved = ['a', 'b', 'c'].map((junk) =>
      getClientIp(new Headers({ 'x-real-ip': '190.3.3.3', 'x-forwarded-for': junk }))
    )
    expect(new Set(resolved).size).toBe(1)
    expect(resolved[0]).toBe('190.3.3.3')
  })
})
