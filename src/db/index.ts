import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// En pruebas (Vitest fija NODE_ENV=test) usamos siempre la base de pruebas,
// nunca la de desarrollo, para que las funciones bajo prueba lean los mismos
// datos que preparó testDb.
const isTest = process.env.NODE_ENV === 'test'
const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(isTest ? 'Falta TEST_DATABASE_URL' : 'Falta DATABASE_URL')
}

// max: 10 es suficiente para un VPS pequeño y evita agotar el Postgres.
const client = postgres(connectionString, { max: 10 })

export const db = drizzle(client, { schema })
export { schema }
