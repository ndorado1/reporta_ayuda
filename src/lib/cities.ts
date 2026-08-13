import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { cities, type City } from '@/db/schema'

export async function listCities(): Promise<City[]> {
  return db.select().from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.position))
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const [city] = await db
    .select()
    .from(cities)
    .where(and(eq(cities.slug, slug), eq(cities.isActive, true)))
    .limit(1)
  return city ?? null
}
