const KEY = 'reporta-cali:ultimo-evento'

export function getLastSeenEventId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastSeenEventId(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Sin almacenamiento el contador se reinicia en cada visita. Aceptable.
  }
}

/**
 * Los eventos llegan del más reciente al más antiguo. Si el último visto
 * ya no aparece (pasó mucho tiempo, o el localStorage quedó desincronizado),
 * se cuentan todos: es preferible avisar de más que de menos.
 */
export function countUnseen(events: { id: string }[], lastSeenId: string | null): number {
  if (events.length === 0) return 0
  if (!lastSeenId) return events.length
  const index = events.findIndex((e) => e.id === lastSeenId)
  return index === -1 ? events.length : index
}
