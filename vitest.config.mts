import { defineConfig } from 'vitest/config'
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
    // Las pruebas de integración comparten una sola base de datos de
    // pruebas y cada una llama a resetTestDb(), que hace TRUNCATE de
    // todas las tablas. Con archivos en paralelo, uno trunca la base
    // mientras otro está a mitad de sus inserciones. Se desactiva el
    // paralelismo entre archivos hasta que cada suite tenga su propia
    // base de datos.
    fileParallelism: false,
  },
})
