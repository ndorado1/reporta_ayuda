import { describe, it, expect, beforeEach } from 'vitest'
import { countUnseen, getLastSeenEventId, setLastSeenEventId } from './notifications'

const events = [{ id: 'c' }, { id: 'b' }, { id: 'a' }] // más reciente primero

beforeEach(() => localStorage.clear())

describe('countUnseen', () => {
  it('cuenta todo si nunca se ha visto nada', () => {
    expect(countUnseen(events, null)).toBe(3)
  })

  it('cuenta solo lo posterior al último visto', () => {
    expect(countUnseen(events, 'b')).toBe(1)
  })

  it('devuelve cero si el último visto es el más reciente', () => {
    expect(countUnseen(events, 'c')).toBe(0)
  })

  it('cuenta todo si el último visto ya no está en la lista', () => {
    expect(countUnseen(events, 'desconocido')).toBe(3)
  })

  it('devuelve cero con la lista vacía', () => {
    expect(countUnseen([], 'c')).toBe(0)
  })
})

describe('último evento visto', () => {
  it('guarda y recupera', () => {
    setLastSeenEventId('abc')
    expect(getLastSeenEventId()).toBe('abc')
  })

  it('devuelve null cuando no hay nada guardado', () => {
    expect(getLastSeenEventId()).toBeNull()
  })
})
