import { describe, it, expect } from 'vitest'
import { normalizePhone, buildWhatsAppLink } from './whatsapp'

describe('normalizePhone', () => {
  it('acepta un celular de diez dígitos', () => {
    expect(normalizePhone('3001234567')).toBe('+573001234567')
  })

  it('ignora espacios, guiones y paréntesis', () => {
    expect(normalizePhone('(300) 123-45 67')).toBe('+573001234567')
  })

  it('acepta el indicativo con y sin signo más', () => {
    expect(normalizePhone('+57 300 123 4567')).toBe('+573001234567')
    expect(normalizePhone('57 3001234567')).toBe('+573001234567')
  })

  it('acepta el cero de marcación nacional', () => {
    expect(normalizePhone('03001234567')).toBe('+573001234567')
  })

  it('rechaza números fijos y longitudes incorrectas', () => {
    expect(normalizePhone('6024851234')).toBeNull()
    expect(normalizePhone('300123456')).toBeNull()
    expect(normalizePhone('30012345678')).toBeNull()
  })

  it('rechaza texto vacío o sin dígitos', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('no tengo')).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('arma el enlace sin el signo más y con el texto codificado', () => {
    const link = buildWhatsAppLink('+573001234567', 'Hola, ¿sigue necesitando agua?')
    expect(link).toBe(
      'https://wa.me/573001234567?text=Hola%2C%20%C2%BFsigue%20necesitando%20agua%3F'
    )
  })
})
