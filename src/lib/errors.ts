/**
 * Errores pensados para mostrarse tal cual a la persona que usa la app
 * ("No autorizado", "Esta solicitud ya está siendo atendida"...). Todo lo
 * demás (fallos de Drizzle, de conexión, de configuración) debe seguir
 * siendo un Error normal para que `fail()` en app/actions.ts lo trate como
 * inesperado y no filtre su mensaje —Drizzle envuelve cualquier fallo de
 * consulta con el SQL y los parámetros literales, que pueden incluir datos
 * personales.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
