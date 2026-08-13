import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { CitySelect } from './CitySelect'
import { CITY_STORAGE_KEY } from '@/lib/city-preference'

const push = vi.fn()
const replace = vi.fn()
let params = new URLSearchParams()

// Sobrescribe el mock global de next/navigation (definido en vitest.setup.ts)
// porque necesitamos controlar qué trae la URL en cada prueba, cosa que el
// stub compartido no permite.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => params,
  usePathname: () => '/',
}))

const cities = [
  { slug: 'cali', name: 'Cali' },
  { slug: 'armenia', name: 'Armenia' },
]

afterEach(() => {
  push.mockClear()
  replace.mockClear()
  params = new URLSearchParams()
  localStorage.clear()
})

describe('CitySelect', () => {
  it('sin ?ciudad= en la URL, aplica la ciudad guardada válida', async () => {
    localStorage.setItem(CITY_STORAGE_KEY, 'armenia')
    render(<CitySelect cities={cities} />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('?ciudad=armenia'))
    expect(push).not.toHaveBeenCalled()
  })

  it('con ?ciudad= en la URL, la URL manda y no toca lo guardado', async () => {
    localStorage.setItem(CITY_STORAGE_KEY, 'armenia')
    params = new URLSearchParams('ciudad=cali')
    render(<CitySelect cities={cities} />)
    // Deja pasar un ciclo de efectos para confirmar que, en efecto, no reacciona.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(replace).not.toHaveBeenCalled()
  })

  it('sin ?ciudad= y sin preferencia guardada, no toca la URL', async () => {
    render(<CitySelect cities={cities} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(replace).not.toHaveBeenCalled()
  })

  it('sin ?ciudad= y con una preferencia guardada que ya no es válida, la ignora', async () => {
    localStorage.setItem(CITY_STORAGE_KEY, 'medellin')
    render(<CitySelect cities={cities} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(replace).not.toHaveBeenCalled()
  })
})
