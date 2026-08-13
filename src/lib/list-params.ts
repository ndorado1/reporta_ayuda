import { REQUEST_STATUSES, URGENCIES, type RequestStatus, type Urgency } from './requests'

/**
 * Valida los parámetros de la URL de la portada contra las listas cerradas
 * de valores del enum antes de que lleguen a una consulta SQL. Un valor
 * que no aparece en la lista (p. ej. "?estado=atendidas" en plural, o
 * cualquier edición a mano del enlace) se ignora en vez de pasar de largo:
 * `inArray`/`eq` sobre una columna enum con un valor fuera de rango
 * revienta en Postgres con 22P02, y eso tumbaba la portada entera para
 * cualquiera que abriera ese enlace. Mismo criterio que ya usa
 * src/app/api/events/route.ts con el parámetro "desde".
 */
export function parseUrgency(value?: string): Urgency | undefined {
  return value && (URGENCIES as string[]).includes(value) ? (value as Urgency) : undefined
}

export function parseStatuses(value?: string): RequestStatus[] | undefined {
  return value && (REQUEST_STATUSES as string[]).includes(value) ? [value as RequestStatus] : undefined
}

/** Página de 1 en adelante. Cualquier valor que no sea un entero positivo cae a 1. */
export function parsePage(value?: string): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}
