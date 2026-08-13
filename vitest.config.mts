import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // e2e/**: son specs de Playwright (se corren con `npm run e2e`, no con
    // Vitest). El patrón por defecto de Vitest incluye *.spec.ts y las
    // recogería igual, reventando porque `test`/`expect` ahí vienen de
    // @playwright/test, no de Vitest. No quitar de esta lista.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Las pruebas de integración comparten una sola base de datos de
    // pruebas y cada una llama a resetTestDb(), que hace TRUNCATE de
    // todas las tablas. Con archivos en paralelo, uno trunca la base
    // mientras otro está a mitad de sus inserciones. Se desactiva el
    // paralelismo entre archivos hasta que cada suite tenga su propia
    // base de datos.
    fileParallelism: false,
  },
})
