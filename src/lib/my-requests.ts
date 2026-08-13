const KEY = 'reporta-cali:mis-solicitudes'

export type MyRequest = {
  publicCode: string
  manageToken: string
  title: string
  createdAt: string
}

/** Nunca lanza: en incógnito o con almacenamiento bloqueado, devuelve vacío. */
export function listMyRequests(): MyRequest[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMyRequest(entry: MyRequest): void {
  try {
    const all = listMyRequests().filter((r) => r.publicCode !== entry.publicCode)
    localStorage.setItem(KEY, JSON.stringify([entry, ...all]))
  } catch {
    // Sin almacenamiento el enlace sigue visible en pantalla; es el respaldo real.
  }
}

export function removeMyRequest(code: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listMyRequests().filter((r) => r.publicCode !== code)))
  } catch {
    // Nada que hacer.
  }
}
