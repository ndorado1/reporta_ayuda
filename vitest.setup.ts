// Algunas pruebas de componentes importan, de forma transitiva, Server
// Actions que a su vez inicializan la conexión a la base de datos (p. ej.
// RequestCard -> ClaimButton -> actions.ts -> lib/claims -> db). Sin cargar
// las variables de entorno aquí, esas pruebas fallan al importar el módulo
// incluso si no llegan a tocar la base de datos, y solo funcionaban antes
// por casualidad de orden si otra prueba ya había cargado dotenv primero.
import 'dotenv/config'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Los componentes cliente que llaman useRouter/useSearchParams (p. ej.
// ClaimButton, RequestFilters) solo funcionan dentro del AppRouterContext
// que monta Next.js en tiempo de ejecución. Vitest no lo provee: sin este
// stub global, cualquier prueba que renderice esos componentes revienta con
// "invariant expected app router to be mounted", aunque la prueba no
// verifique nada de navegación. Un archivo de prueba puede sobrescribir
// este mock con el suyo si necesita otro comportamiento.
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
  }
})
