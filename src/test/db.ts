import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '@/db/schema'

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error('Falta TEST_DATABASE_URL')

const client = postgres(url, { max: 1 })
export const testDb = drizzle(client, { schema })

let migrated = false

/** Deja la base vacía y migrada antes de cada prueba. */
export async function resetTestDb() {
  if (!migrated) {
    await migrate(testDb, { migrationsFolder: './drizzle' })
    migrated = true
  }
  await testDb.execute(
    sql`TRUNCATE events, reports, claims, request_items, requests, rate_limits, cities RESTART IDENTITY CASCADE`
  )
}

/** Inserta Cali y la devuelve, que es lo que casi toda prueba necesita. */
export async function seedTestCity() {
  const [city] = await testDb.insert(schema.cities).values({
    slug: 'cali', name: 'Cali', department: 'Valle del Cauca',
    centerLat: 3.4516, centerLng: -76.532, defaultZoom: 12, position: 1,
  }).returning()
  return city
}
