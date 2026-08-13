import { describe, it, expect } from 'vitest'
import { parseUrgency, parseStatuses, parsePage } from './list-params'

describe('parseStatuses', () => {
  it('acepta un estado válido del enum', () => {
    expect(parseStatuses('atendida')).toEqual(['atendida'])
  })

  // Este es exactamente el caso verificado contra Postgres: "?estado=atendidas"
  // (plural, por un enlace editado a mano) produce 22P02 si llega crudo hasta
  // `inArray`. Sin la validación, esta prueba fallaría porque devolvería
  // ['atendidas'] en vez de undefined.
  it('ignora un valor que no está en el enum en vez de dejarlo pasar', () => {
    expect(parseStatuses('atendidas')).toBeUndefined()
  })

  it('ignora un valor vacío o ausente', () => {
    expect(parseStatuses('')).toBeUndefined()
    expect(parseStatuses(undefined)).toBeUndefined()
  })

  // `cancelada` y `archivada` sí están en REQUEST_STATUSES (las usa la
  // moderación), pero no deben poder pedirse desde la URL pública: una
  // cancelada ya no tiene detalle (404 en su enlace) y una archivada
  // convertiría el propio listado en un directorio navegable de solicitudes
  // que antes solo eran alcanzables por su código. Sin esta exclusión, esta
  // prueba fallaría porque devolvería ['cancelada']/['archivada'].
  it('ignora "cancelada" y "archivada" aunque sean estados válidos del enum', () => {
    expect(parseStatuses('cancelada')).toBeUndefined()
    expect(parseStatuses('archivada')).toBeUndefined()
  })
})

describe('parseUrgency', () => {
  it('acepta una urgencia válida', () => {
    expect(parseUrgency('alta')).toBe('alta')
  })

  it('ignora una urgencia que no existe', () => {
    expect(parseUrgency('extrema')).toBeUndefined()
  })
})

describe('parsePage', () => {
  it('usa la página 1 por defecto', () => {
    expect(parsePage(undefined)).toBe(1)
  })

  it('acepta un número de página válido', () => {
    expect(parsePage('3')).toBe(3)
  })

  it('cae a la página 1 con un valor que no es un entero positivo', () => {
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-2')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('1.5')).toBe(1)
  })
})
