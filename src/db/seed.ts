import 'dotenv/config'
import { db } from './index'
import { cities } from './schema'

const CITIES = [
  { slug: 'cali', name: 'Cali', department: 'Valle del Cauca', centerLat: 3.4516, centerLng: -76.532, defaultZoom: 12, position: 1 },
  { slug: 'armenia', name: 'Armenia', department: 'Quindío', centerLat: 4.5339, centerLng: -75.6811, defaultZoom: 13, position: 2 },
  { slug: 'pereira', name: 'Pereira', department: 'Risaralda', centerLat: 4.8133, centerLng: -75.6961, defaultZoom: 13, position: 3 },
  { slug: 'buenaventura', name: 'Buenaventura', department: 'Valle del Cauca', centerLat: 3.8801, centerLng: -77.0312, defaultZoom: 12, position: 4 },
  { slug: 'quibdo', name: 'Quibdó', department: 'Chocó', centerLat: 5.6947, centerLng: -76.6611, defaultZoom: 13, position: 5 },
]

async function main() {
  for (const city of CITIES) {
    await db.insert(cities).values(city).onConflictDoUpdate({
      target: cities.slug,
      set: { name: city.name, department: city.department, position: city.position },
    })
  }
  console.log(`Sembradas ${CITIES.length} ciudades.`)
  process.exit(0)
}

main()
