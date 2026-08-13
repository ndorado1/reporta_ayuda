import { describe, it, expect } from 'vitest'
import { resolveCitySlug } from './city-preference'

const valid = ['cali', 'armenia', 'pereira']

describe('resolveCitySlug', () => {
  it('la URL manda sobre lo guardado', () => {
    expect(resolveCitySlug('armenia', 'cali', valid)).toBe('armenia')
  })

  it('usa lo guardado cuando la URL no dice nada', () => {
    expect(resolveCitySlug(null, 'cali', valid)).toBe('cali')
  })

  it('devuelve null cuando no hay preferencia: se ven todas', () => {
    expect(resolveCitySlug(null, null, valid)).toBeNull()
  })

  it('ignora una ciudad desconocida en la URL', () => {
    expect(resolveCitySlug('medellin', 'cali', valid)).toBe('cali')
  })

  it('ignora un valor guardado que ya no es válido', () => {
    expect(resolveCitySlug(null, 'medellin', valid)).toBeNull()
  })

  it('acepta "todas" como forma explícita de quitar el filtro', () => {
    expect(resolveCitySlug('todas', 'cali', valid)).toBeNull()
  })
})
