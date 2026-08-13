import { describe, it, expect } from 'vitest'
import { getClientIp } from './request-ip'

describe('getClientIp', () => {
  it('toma la primera IP de x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '190.1.1.1, 10.0.0.1' })
    expect(getClientIp(h)).toBe('190.1.1.1')
  })

  it('usa x-real-ip cuando no hay x-forwarded-for', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '190.2.2.2' }))).toBe('190.2.2.2')
  })

  it('devuelve un marcador cuando no hay cabeceras', () => {
    expect(getClientIp(new Headers())).toBe('0.0.0.0')
  })
})
