import 'dotenv/config'
import { runMaintenance } from '@/lib/maintenance'

runMaintenance()
  .then((result) => {
    console.log(`[${new Date().toISOString()}] anonimizadas: ${result.anonymized}, archivadas: ${result.archived}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[${new Date().toISOString()}] falló el mantenimiento:`, error)
    process.exit(1)
  })
