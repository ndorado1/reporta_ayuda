import { describe, it, expect, vi } from 'vitest'

// next/cache no funciona fuera de una petición real de Next; se hace no-op
// para poder invocar la Server Action directamente desde una prueba.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Simula el fallo que Drizzle produce de verdad: el mensaje trae el SQL
// completo y los parámetros literales (ver node_modules/drizzle-orm/errors.js).
// Si `fail()` alguna vez volviera a devolver `e.message` sin filtrar, esta
// prueba fallaría porque el texto de abajo aparecería en la respuesta.
const sqlLeak =
  'Failed query: update "requests" set "status" = $1 where "id" = $2\n' +
  'params: cancelada,3001234567'

vi.mock('@/lib/requests', async () => {
  const actual = await vi.importActual<typeof import('@/lib/requests')>('@/lib/requests')
  return {
    ...actual,
    cancelRequest: vi.fn(async () => {
      throw new Error(sqlLeak)
    }),
  }
})

import { cancelRequestAction } from './actions'
import { cancelRequest } from '@/lib/requests'
import { DomainError } from '@/lib/errors'

describe('fail() en las Server Actions', () => {
  it('no expone el mensaje de un error inesperado de base de datos', async () => {
    const result = await cancelRequestAction('ABC123', 'token-cualquiera')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('la acción debía fallar')
    expect(result.error).toBe('No pudimos guardar. Inténtalo de nuevo en un momento.')
    expect(result.error).not.toContain('Failed query')
    expect(result.error).not.toContain('3001234567')
  })

  // La otra mitad del contrato: un DomainError sí trae un mensaje pensado
  // para mostrarse ("No autorizado", "El número debe ser un celular
  // colombiano de diez dígitos") y `fail()` debe dejarlo pasar tal cual. Si
  // `fail()` se rompiera para devolver siempre el genérico, esta prueba
  // fallaría porque el mensaje esperado no llegaría al resultado.
  it('sí expone el mensaje de un DomainError esperado', async () => {
    vi.mocked(cancelRequest).mockRejectedValueOnce(new DomainError('No autorizado'))

    const result = await cancelRequestAction('ABC123', 'token-cualquiera')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('la acción debía fallar')
    expect(result.error).toBe('No autorizado')
  })
})
