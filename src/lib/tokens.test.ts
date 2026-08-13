import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateToken,
  hashToken,
  verifyToken,
  generatePublicCode,
  hashIp,
} from './tokens'

beforeAll(() => {
  process.env.IP_HASH_SECRET = 'secreto-de-prueba'
})

describe('tokens de gestión', () => {
  it('genera tokens distintos en cada llamada', () => {
    expect(generateToken()).not.toBe(generateToken())
  })

  it('genera tokens suficientemente largos', () => {
    expect(generateToken().length).toBeGreaterThanOrEqual(43)
  })

  it('no guarda el token en claro: el hash es distinto del token', () => {
    const token = generateToken()
    expect(hashToken(token)).not.toBe(token)
  })

  it('verifica el token correcto y rechaza el incorrecto', () => {
    const token = generateToken()
    const hash = hashToken(token)
    expect(verifyToken(token, hash)).toBe(true)
    expect(verifyToken(generateToken(), hash)).toBe(false)
  })

  it('rechaza sin lanzar cuando el hash tiene longitud inesperada', () => {
    expect(verifyToken(generateToken(), 'corto')).toBe(false)
  })
})

describe('códigos públicos', () => {
  it('tiene seis caracteres', () => {
    expect(generatePublicCode()).toHaveLength(6)
  })

  it('excluye caracteres que se confunden al dictarlos por teléfono', () => {
    const codes = Array.from({ length: 200 }, () => generatePublicCode()).join('')
    expect(codes).not.toMatch(/[01IOl]/)
  })
})

describe('hashIp', () => {
  it('es estable para la misma IP', () => {
    expect(hashIp('190.0.0.1')).toBe(hashIp('190.0.0.1'))
  })

  it('difiere entre IPs distintas', () => {
    expect(hashIp('190.0.0.1')).not.toBe(hashIp('190.0.0.2'))
  })

  it('cambia si cambia el secreto, de modo que no es un sha256 simple', () => {
    const conSecretoA = hashIp('190.0.0.1')
    process.env.IP_HASH_SECRET = 'otro-secreto'
    expect(hashIp('190.0.0.1')).not.toBe(conSecretoA)
    process.env.IP_HASH_SECRET = 'secreto-de-prueba'
  })
})
