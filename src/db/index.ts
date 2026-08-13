import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = PostgresJsDatabase<typeof schema>

let instance: Db | undefined

function connect(): Db {
  // En pruebas (Vitest fija NODE_ENV=test) usamos siempre la base de pruebas,
  // nunca la de desarrollo, para que las funciones bajo prueba lean los mismos
  // datos que preparó testDb.
  const isTest = process.env.NODE_ENV === 'test'
  const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(isTest ? 'Falta TEST_DATABASE_URL' : 'Falta DATABASE_URL')
  }

  // max: 10 es suficiente para un VPS pequeño y evita agotar el Postgres.
  return drizzle(postgres(connectionString, { max: 10 }), { schema })
}

// La conexión se abre en el primer uso real, no al importar el módulo.
//
// `next build` evalúa cada módulo del árbol para leer la configuración de
// ruta, y el layout raíz importa esto a través de `lib/cities`. Si la
// conexión se creara aquí arriba, el build fallaría con "Falta DATABASE_URL"
// en cualquier entorno que construya la imagen sin acceso a la base —que es
// lo normal: un build no debería necesitar la base de producción, y pasarle
// la cadena de conexión como argumento de build la dejaría grabada en el
// historial de capas de la imagen.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= connect()
    const value = Reflect.get(instance, prop)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

export { schema }
